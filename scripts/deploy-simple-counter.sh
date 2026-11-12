#!/usr/bin/env bash
# Run the pinned, reviewed release under systemd so a console disconnect cannot
# kill the build. Delegates backups, migrations and rollback to the audited installer.
set -euo pipefail
umask 077
export PATH="/opt/node22/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
APP=${CAFE_APP_DIR:-/var/www/engineer-cafe}
TARGET=${1:?Supply the reviewed full release SHA}
[[ "$TARGET" =~ ^[0-9a-f]{40}$ ]]
cd "$APP"
git cat-file -e "$TARGET^{commit}"
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo 'Tracked changes found. Preserve/review them first.'; exit 1; }
BASE=8c12296027dfd02cc4afec3cd78ac8e672828161
git merge-base --is-ancestor "$BASE" "$TARGET"
install -d -m 700 /var/backups/engineer-cafe
# Shares the lock used by the prior interrupted-release recovery command.
exec 9>/var/backups/engineer-cafe/.deployment-recovery.lock
flock -n 9 || { echo 'Another cafe deployment/recovery is already running.'; exit 1; }
node <<'NODE'
require('@next/env').loadEnvConfig(process.cwd(), false);
if (Number(process.versions.node.split('.')[0]) !== 22) throw Error('Use the installed Node 22 in /opt/node22/bin.');
const secret=process.env.AUTH_SECRET ?? process.env.JWT_SECRET;
if(!secret || secret.length<32 || /replace-with|development-secret|change-me/i.test(secret)) throw Error('Configure a random AUTH_SECRET of at least 32 characters first.');
const raw=process.env.NEXT_PUBLIC_SITE_URL ?? process.env.FRONTEND_URL ?? process.env.RENDER_EXTERNAL_URL ?? '';
let origin;try{origin=new URL(/^https?:\/\//.test(raw)?raw:`https://${raw}`).origin;}catch{}
if(origin!=='https://esellerstore.vip') throw Error('Set NEXT_PUBLIC_SITE_URL=https://esellerstore.vip in .env first.');
console.log('PASS: Node and configuration checks.');
NODE
nginx -t
pm2 describe engineer-cafe >/dev/null
WORK=$(mktemp -d /var/backups/engineer-cafe/counter-release.XXXXXXXX)
echo "Private release work: $WORK"
git show "$TARGET:scripts/deploy-demo-manager.sh" > "$WORK/deploy.sh"
# Compile the target in a separate source directory before any service is stopped.
# Existing dependencies can be used only when their lockfile/schema are unchanged.
if git diff --quiet HEAD "$TARGET" -- package-lock.json prisma/schema.prisma; then
 git show "$TARGET:scripts/check-release-types.sh" > "$WORK/check-types.sh"
 bash "$WORK/check-types.sh" "$TARGET" "$WORK/typecheck"
else
 echo 'Dependencies/schema differ: installer will check types after installing them.'
fi
if [ ! -s .next/BUILD_ID ]; then
 # Handle ONLY the exact interrupted release and private snapshot seen in the
 # operator's console. Never guess a snapshot or restore an old database dump.
 [ "$(git rev-parse HEAD)" = "$BASE" ] || { echo 'Build missing on an unexpected release; inspect before recovery.'; exit 1; }
 SNAP=/var/backups/engineer-cafe/demo-release.UesGTuBC
 [ -s "$SNAP/previous-build/BUILD_ID" ] || { echo 'Known previous build missing; manual recovery is required.'; exit 1; }
 pm2 jlist | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const names=["engineer-cafe","engineer-cafe-notifications","engineer-cafe-demo-worker"];if(JSON.parse(s).some(p=>names.includes(p.name)&&p.pm2_env.status==="online")){console.error("Cafe services are running with a missing build; inspect their state before recovery.");process.exitCode=1;}});'
 OLD=$(cat "$SNAP/previous-commit")
 [[ "$OLD" =~ ^[0-9a-f]{40}$ ]]
 git cat-file -e "$OLD^{commit}"
 git merge-base --is-ancestor "$OLD" "$BASE"
 node - "$SNAP/pm2-before.json" > "$WORK/workers-before" <<'NODE'
const fs=require('node:fs');
for(const p of JSON.parse(fs.readFileSync(process.argv[2],'utf8')))
 if(['engineer-cafe-notifications','engineer-cafe-demo-worker'].includes(p.name)&&p.pm2_env.status==='online')console.log(p.name);
NODE
 if [ -d "$SNAP/previous-dependencies" ]; then
  if [ -e node_modules ]; then mv node_modules "$WORK/interrupted-dependencies"; fi
  mv "$SNAP/previous-dependencies" node_modules
 else
  node - "$OLD" <<'NODE'
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const lock=JSON.parse(execFileSync('git',['show',process.argv[2]+':package-lock.json'],{encoding:'utf8'}));
const next=JSON.parse(fs.readFileSync('node_modules/next/package.json','utf8'));
if(next.version!==lock.packages['node_modules/next'].version)throw Error('Previous dependencies cannot be verified; recovery stopped.');
NODE
 fi
 if [ -e .next ]; then mv .next "$WORK/interrupted-build"; fi
 git switch --detach "$OLD"
 mv "$SNAP/previous-build" .next
 pm2 restart engineer-cafe --update-env >/dev/null
 for attempt in $(seq 1 20); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:3100/api/settings -o /dev/null; then break; fi
  [ "$attempt" -lt 20 ] || { echo 'Recovered build did not pass the local health check; inspect PM2.'; exit 1; }
  sleep 2
 done
 while IFS= read -r name; do
  [ -n "$name" ] && pm2 restart "$name" --update-env >/dev/null
 done < "$WORK/workers-before"
 pm2 save >/dev/null
 echo 'PASS: interrupted website build recovered; database was not restored.'
fi
# Installer verifies the prior release and unchanged permission grants, backs up
# the website and database, then builds and tests the pinned release with rollback.
bash "$WORK/deploy.sh" "$TARGET"
curl --fail --silent --show-error --max-time 30 --resolve esellerstore.vip:443:127.0.0.1 https://esellerstore.vip/api/health
echo
echo "SUCCESS: $TARGET deployed; public database health passed."

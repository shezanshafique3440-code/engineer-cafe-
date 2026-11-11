#!/usr/bin/env bash
# Run only after reviewing this release. It installs the owner tools; it does NOT
# seed or reset data. The owner must review and confirm those actions in the UI.
set -euo pipefail
umask 077
export PATH="/opt/node22/bin:$PATH"
APP=${CAFE_APP_DIR:-/var/www/engineer-cafe}
TARGET=${1:?Supply the reviewed full demo-manager commit SHA}
[[ "$TARGET" =~ ^[0-9a-f]{40}$ ]]
cd "$APP"
git cat-file -e "$TARGET^{commit}"
BASE=4d5d0fb686e162f095e286df2f4fadec0e6d9873
git merge-base --is-ancestor "$BASE" "$TARGET"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
 echo 'Tracked changes found. Preserve/review them before deploying.'; exit 1
fi
OLD=$(git rev-parse HEAD)
PREVIOUS_DEMO=587af3ca3aafc9938c2372f6a2c47c2b20e58823
PREVIOUS_OFFLINE=7677e193235d31c91cccf6eef9ef727b1d39d689
PREVIOUS_CASH=49d230c0a81cbc64a55053bcdf65221108f702a1
PREVIOUS_ROUTING=a94d8e822656e309bbec20c223023a93de0e1113
if [ "$OLD" != "$PREVIOUS_ROUTING" ] && [ "$OLD" != "$PREVIOUS_CASH" ] && [ "$OLD" != "$BASE" ] && [ "$OLD" != "$PREVIOUS_DEMO" ] && [ "$OLD" != "$PREVIOUS_OFFLINE" ] && [ "$OLD" != "$TARGET" ]; then
 echo 'This installer expects the audited baseline, previous demo release, or the same target. Inspect the current commit first.'; exit 1
fi
if ! git diff --quiet "$BASE" "$TARGET" -- src/lib/business-access.ts; then
 echo 'Unexpected staff-role changes in this release. Stopping.'; exit 1
fi
# This reviewed release adds only the pinned Excel writer; reject unrelated changes.
node - "$BASE" "$TARGET" <<'JS'
const {execFileSync}=require('node:child_process');const {deepStrictEqual}=require('node:assert/strict');
const read=ref=>JSON.parse(execFileSync('git',['show',ref+':package.json'],{encoding:'utf8'}));
const before=read(process.argv[2]),after=read(process.argv[3]);
if(after.dependencies.exceljs!=='4.4.0')throw Error('Unexpected Excel dependency version.');
delete after.dependencies.exceljs;deepStrictEqual(after,before,'Unexpected package changes.');
JS
pm2 describe engineer-cafe >/dev/null
test -f .env
test -f .next/BUILD_ID
SNAPSHOT=$(mktemp -d /var/backups/engineer-cafe/demo-release.XXXXXXXX)
chmod 700 "$SNAPSHOT"
printf '%s\n' "$OLD" > "$SNAPSHOT/previous-commit"
cp -p .env "$SNAPSHOT/previous.env"
pm2 jlist > "$SNAPSHOT/pm2-before.json"
git show "$TARGET:scripts/demo-backup.cjs" > "$SNAPSHOT/demo-backup.cjs"
APP_WAS_ONLINE=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>console.log(JSON.parse(s).some(p=>p.name==="engineer-cafe"&&p.pm2_env.status==="online")?1:0))')
NOTIFY_WAS_ONLINE=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>console.log(JSON.parse(s).some(p=>p.name==="engineer-cafe-notifications"&&p.pm2_env.status==="online")?1:0))')
DEMO_WAS_ONLINE=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>console.log(JSON.parse(s).some(p=>p.name==="engineer-cafe-demo-worker"&&p.pm2_env.status==="online")?1:0))')
# Refuse deployment while an owner job is still pending, including crash recovery.
node - <<'JS'
require('@next/env').loadEnvConfig(process.cwd(),false);
const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
(async()=>{const [r]=await db.$queryRawUnsafe(`SELECT to_regclass('public."DemoJob"')::text AS name`);if(r.name){const jobs=await db.$queryRawUnsafe(`SELECT id FROM "DemoJob" WHERE status IN ('QUEUED','RUNNING')`);if(jobs.length)throw Error('Finish or recover the active demo job before deploying.');}})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
JS
MOVED=0
rollback() {
 code=$?
 if [ "$code" -eq 0 ]; then return; fi
 trap - EXIT
 echo 'Deployment failed. Restoring the previous code/build; the private release snapshot is retained for review.'
 pm2 stop engineer-cafe >/dev/null 2>&1 || true
 pm2 stop engineer-cafe-demo-worker >/dev/null 2>&1 || true
 git switch --detach "$OLD" || true
 if [ "$MOVED" -eq 1 ]; then
  if [ -e .next ]; then mv .next "$SNAPSHOT/failed-build"; fi
  mv "$SNAPSHOT/previous-build" .next
 fi
 if [ -x node_modules/.bin/prisma ]; then ./node_modules/.bin/prisma generate >/dev/null 2>&1 || true; fi
 if [ "$APP_WAS_ONLINE" = 1 ]; then pm2 restart engineer-cafe --update-env >/dev/null || true; fi
 if [ "$NOTIFY_WAS_ONLINE" = 1 ]; then pm2 restart engineer-cafe-notifications --update-env >/dev/null || true; fi
 if [ "$DEMO_WAS_ONLINE" = 1 ]; then pm2 restart engineer-cafe-demo-worker --update-env >/dev/null || true; fi
 echo "Private release snapshot: $SNAPSHOT"
 echo 'No database dump was restored automatically. Inspect any failed Prisma migration before retrying.'
 exit "$code"
}
trap rollback EXIT
pm2 stop engineer-cafe >/dev/null
if pm2 describe engineer-cafe-notifications >/dev/null 2>&1; then pm2 stop engineer-cafe-notifications >/dev/null; fi
if pm2 describe engineer-cafe-demo-worker >/dev/null 2>&1; then pm2 stop engineer-cafe-demo-worker >/dev/null; fi
# Stop only this cafe's services. Other VPS applications remain untouched.
CAFE_DEMO_BACKUP_DIR="$SNAPSHOT/database" node - "$SNAPSHOT/demo-backup.cjs" <<'JS'
require('@next/env').loadEnvConfig(process.cwd(),false);
const backup=require(process.argv[2]).backupDatabase('release');
console.log('PASS: private database dump verified; SHA-256 '+backup.hash);
JS
tar --exclude='engineer-cafe/node_modules' --exclude='engineer-cafe/.next/cache' -czf "$SNAPSHOT/website.tar.gz" -C "$(dirname "$APP")" "$(basename "$APP")"
gzip -t "$SNAPSHOT/website.tar.gz"
mv .next "$SNAPSHOT/previous-build"
MOVED=1
git switch --detach "$TARGET"
if ! git diff --quiet "$OLD" "$TARGET" -- package-lock.json || [ ! -x node_modules/.bin/tsx ] || [ ! -x node_modules/.bin/prisma ]; then npm ci --no-audit --no-fund; fi
npm run db:generate
npm run db:deploy
npm run typecheck
NODE_OPTIONS=--max-old-space-size=2048 npm run build
pm2 restart engineer-cafe --update-env >/dev/null
for attempt in $(seq 1 20); do
 if curl --fail --silent --max-time 5 http://127.0.0.1:3100/api/settings -o /dev/null; then break; fi
 if [ "$attempt" = 20 ]; then echo 'Cafe health check failed.'; exit 1; fi
 sleep 2
done
status=$(curl --silent --show-error --max-time 20 -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/api/admin/demo-data)
[ "$status" = 401 ]
status=$(curl --silent --show-error --max-time 20 -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/api/admin/complete-report)
[ "$status" = 401 ]
curl --fail --silent --show-error --max-time 30 --resolve esellerstore.vip:443:127.0.0.1 https://esellerstore.vip/api/settings -o /dev/null
# Verify every offline shell asset through both Next and public HTTPS before
# starting the workers. A 200 HTML fallback for a JavaScript file is not success.
for asset in offline.html offline-home.js offline-pos.html offline-pos-bootstrap.js offline-pos-store.js offline-pos.js sw.js; do
 curl --fail --silent --show-error --max-time 30 "http://127.0.0.1:3100/$asset" -o "$SNAPSHOT/app-$asset"
 cmp "$APP/public/$asset" "$SNAPSHOT/app-$asset"
 curl --fail --silent --show-error --max-time 30 --resolve esellerstore.vip:443:127.0.0.1 "https://esellerstore.vip/$asset" -o "$SNAPSHOT/domain-$asset"
 cmp "$APP/public/$asset" "$SNAPSHOT/domain-$asset"
done
echo 'PASS: offline page, bootstrap, scripts and service worker match through app and HTTPS.'
if [ "$NOTIFY_WAS_ONLINE" = 1 ]; then pm2 restart engineer-cafe-notifications --update-env >/dev/null; fi
if pm2 describe engineer-cafe-demo-worker >/dev/null 2>&1; then
 pm2 restart engineer-cafe-demo-worker --update-env >/dev/null
else
 pm2 start scripts/demo-manager.cjs --name engineer-cafe-demo-worker --cwd "$APP" >/dev/null
fi
pm2 save >/dev/null
trap - EXIT
echo "PASS: Cafe update deployed. Complete Excel report: https://esellerstore.vip/admin/business?section=overview"
echo 'No demo data was loaded or reset by this installer. Use the owner page to preview and confirm.'
echo "Private release snapshot: $SNAPSHOT"

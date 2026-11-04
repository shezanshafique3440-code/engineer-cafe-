#!/usr/bin/env bash
# Run on the existing VPS after fetching the reviewed code commit.
set -euo pipefail
umask 077
export PATH="/opt/node22/bin:$PATH"
APP=/var/www/engineer-cafe
TARGET=${1:?Supply the full mobile-polish commit SHA}
[[ "$TARGET" =~ ^[0-9a-f]{40}$ ]]
cd "$APP"
git cat-file -e "$TARGET^{commit}"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Tracked local changes found. Stopping so they can be preserved."
  exit 1
fi
OLD=$(git rev-parse HEAD)
if [ "$OLD" = "$TARGET" ]; then echo "This code commit is already checked out; inspect PM2 and build before redeploying."; exit 1; fi
if ! git diff --quiet "$OLD" "$TARGET" -- package.json package-lock.json prisma/schema.prisma prisma/migrations; then
  echo "Dependency or database changes detected. This UI-only updater will not proceed."
  exit 1
fi
pm2 describe engineer-cafe >/dev/null
test -f .env
test -f .next/BUILD_ID
BACKUP=$(mktemp -d /var/backups/cafe-mobile.XXXXXXXX)
printf '%s\n' "$OLD" > "$BACKUP/previous-commit"
cp -p .env "$BACKUP/previous.env"
curl --fail --silent --show-error --max-time 30 'http://127.0.0.1:3100/api/products?perPage=60' -o "$BACKUP/products-before.json"
set -a
source .env
set +a
pm2 stop engineer-cafe
BUILD_MOVED=0
rollback() {
  code=$?
  if [ "$code" -eq 0 ]; then return; fi
  trap - EXIT
  echo "Update failed; restoring the previous code and production build."
  pm2 stop engineer-cafe || true
  git switch --detach "$OLD" || echo "Code restore needs inspection: $OLD"
  if [ "$BUILD_MOVED" -eq 1 ]; then
    if [ -e .next ]; then mv .next "$BACKUP/failed-build"; fi
    mv "$BACKUP/previous-build" .next
  fi
  pm2 restart engineer-cafe --update-env || true
  echo "Backup: $BACKUP"
  exit "$code"
}
trap rollback EXIT
mv .next "$BACKUP/previous-build"
BUILD_MOVED=1
git switch --detach "$TARGET"
npm run typecheck
npm run lint
node --import tsx src/lib/__tests__/mobile-utils.test.ts
NODE_OPTIONS="--max-old-space-size=2048" npm run build
pm2 restart engineer-cafe --update-env
curl --retry 10 --retry-connrefused --retry-delay 2 --max-time 30 --fail --silent --show-error \
  http://127.0.0.1:3100/admin/login -o "$BACKUP/login.html"
grep -q 'Cafe control room' "$BACKUP/login.html"
curl --fail --silent --show-error --max-time 30 'http://127.0.0.1:3100/api/products?perPage=60' -o "$BACKUP/products-after.json"
node - "$BACKUP" <<'JS'
const fs = require('node:fs');
const root = process.argv[2];
const read = name => {
  const data = JSON.parse(fs.readFileSync(root + '/' + name, 'utf8'));
  if (!Array.isArray(data.products)) throw new Error('Products response is invalid.');
  return data.products.map(p => [p.id, p.image, p.price]).sort((a,b) => String(a[0]).localeCompare(String(b[0])));
};
if (JSON.stringify(read('products-before.json')) !== JSON.stringify(read('products-after.json'))) {
  throw new Error('Product prices or images differ; inspect concurrent menu edits.');
}
console.log('PASS: existing menu prices and image paths preserved.');
JS
curl --fail --silent --show-error --max-time 30 --resolve esellerstore.vip:443:127.0.0.1 \
  https://esellerstore.vip/admin/login -o "$BACKUP/domain-login.html"
grep -q 'Cafe control room' "$BACKUP/domain-login.html"
pm2 save
trap - EXIT
echo "PASS: mobile polish deployed; production build, login page and HTTPS checks passed."
echo "Backup: $BACKUP"
echo "Code is pinned to commit: $TARGET"

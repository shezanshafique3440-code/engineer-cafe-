#!/usr/bin/env bash
set -euo pipefail
umask 077
export PATH="/opt/node22/bin:$PATH"
APP=/var/www/engineer-cafe
PACK=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$APP"
test -f .env
test -f .next/BUILD_ID
pm2 describe engineer-cafe >/dev/null
set -a
source .env
set +a

node "$PACK/update-images.cjs" check
BACKUP=$(mktemp -d /var/backups/engineer-cafe-images.XXXXXXXX)
chmod 700 "$BACKUP"
cp .next/BUILD_ID "$BACKUP/previous-build-id"
pm2 stop engineer-cafe

DB_CHANGED=0
BUILD_MOVED=0
rollback_on_failure() {
  code=$?
  if [ "$code" -eq 0 ]; then return; fi
  trap - EXIT
  echo "Installation failed. Restoring the previous menu images and build..."
  if [ "$DB_CHANGED" -eq 1 ]; then
    node "$PACK/update-images.cjs" rollback "$BACKUP/images.json" || echo "Database rollback needs inspection: $BACKUP"
  fi
  if [ "$BUILD_MOVED" -eq 1 ]; then
    if [ -e "$APP/.next" ]; then mv "$APP/.next" "$BACKUP/failed-build"; fi
    mv "$BACKUP/previous-build" "$APP/.next"
  fi
  pm2 restart engineer-cafe || true
  echo "Backup directory: $BACKUP"
  exit "$code"
}
trap rollback_on_failure EXIT

mv .next "$BACKUP/previous-build"
BUILD_MOVED=1
DEST="$APP/public/uploads/menu-photos-v1"
mkdir -p "$DEST"
chmod 755 "$DEST"
for image in "$PACK"/images/*.png; do
  name=$(basename "$image")
  if [ -e "$DEST/$name" ]; then
    cmp --silent "$image" "$DEST/$name" || { echo "An existing image differs: $name"; exit 1; }
  else
    install -m 644 "$image" "$DEST/$name"
  fi
done

node "$PACK/update-images.cjs" apply "$BACKUP/images.json"
DB_CHANGED=1
NODE_OPTIONS="--max-old-space-size=2048" npm run build
node "$PACK/update-images.cjs" verify
pm2 restart engineer-cafe

curl --retry 10 --retry-connrefused --retry-delay 2 --max-time 30 \
  --fail --silent --show-error http://127.0.0.1:3100/ -o "$BACKUP/home-check.html"
grep -q '/uploads/menu-photos-v1/' "$BACKUP/home-check.html"
for image in "$PACK"/images/*.png; do
  curl --fail --silent --show-error --max-time 30 \
    "http://127.0.0.1:3100/uploads/menu-photos-v1/$(basename "$image")" -o /dev/null
done
curl --fail --silent --show-error --max-time 30 \
  http://127.0.0.1:3100/menu -o "$BACKUP/menu-check.html"
grep -q '/uploads/menu-photos-v1/' "$BACKUP/menu-check.html"
curl --fail --silent --show-error --max-time 30 \
  -H 'Host: 2.24.193.142' http://127.0.0.1/ -o "$BACKUP/nginx-check.html"
grep -q '/uploads/menu-photos-v1/' "$BACKUP/nginx-check.html"
pm2 save
trap - EXIT
echo "PASS: 35 new images, rebuilt pages, homepage, menu and Nginx checks."
echo "Previous image paths and production build retained in: $BACKUP"

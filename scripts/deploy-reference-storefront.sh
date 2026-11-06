#!/usr/bin/env bash
# Immutable pre-release snapshots, then the existing guarded cafe updater.
set -euo pipefail
umask 077
export PATH="/opt/node22/bin:$PATH"
APP=${CAFE_APP_DIR:-/var/www/engineer-cafe}
BACKUP_ROOT=${CAFE_BACKUP_ROOT:-/var/backups/engineer-cafe}
TARGET=${1:?Supply the full reviewed commit SHA}
HOUSE_THEME=${CAFE_SHARED_THEME:-}
unset CAFE_SHARED_THEME
if [ -n "$HOUSE_THEME" ]; then
  case "$HOUSE_THEME" in chai|midnight|matcha|saffron|gulabi|graphite|ocean|royal|terracotta|espresso) ;; *) echo "Unsupported shared theme"; exit 1 ;; esac
fi
[[ "$TARGET" =~ ^[0-9a-f]{40}$ ]]
cd "$APP"
APP=$(pwd -P)
git cat-file -e "$TARGET^{commit}"
OLD=$(git rev-parse HEAD)
if [ "$OLD" = "$TARGET" ]; then
  echo "This commit is already checked out. Inspect the running release before repeating the deployment."
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Tracked local edits found; stopping before changing the live app."
  exit 1
fi
if ! git diff --quiet "$OLD" "$TARGET" -- package.json package-lock.json prisma/schema.prisma prisma/migrations; then
  git show "$TARGET:scripts/check-experience-release.cjs" | node - "$OLD" "$TARGET"
fi
test -f .env
test -s .next/BUILD_ID
pm2 describe engineer-cafe >/dev/null
docker inspect infra-postgres-1 >/dev/null
mkdir -p "$BACKUP_ROOT"
BACKUP_ROOT=$(cd "$BACKUP_ROOT" && pwd -P)
chmod 700 "$BACKUP_ROOT"
if [ -e "$BACKUP_ROOT/latest" ] && [ ! -L "$BACKUP_ROOT/latest" ]; then
  echo "Backup latest path is not a symlink. Stopping without replacing it."
  exit 1
fi
# Allow room for snapshots, the updater's previous build and a new build.
need_kb=$(( $(du -sk .next public node_modules | awk '{sum+=$1} END {print sum}') * 3 + 524288 ))
free_kb=$(df -Pk "$APP" | awk 'END {print $4}')
backup_free_kb=$(df -Pk "$BACKUP_ROOT" | awk 'END {print $4}')
if [ "$free_kb" -lt "$need_kb" ] || [ "$backup_free_kb" -lt "$need_kb" ]; then
  echo "Not enough free disk space for retained backups and a new build."
  exit 1
fi
BACKUP=$(mktemp -d "$BACKUP_ROOT/release-$(date -u +%Y%m%d-%H%M%S).XXXXXXXX")
printf '%s\n' "$OLD" > "$BACKUP/previous-commit"
printf '%s\n' "$TARGET" > "$BACKUP/target-commit"
printf '%s\n' "$APP" > "$BACKUP/app-path"
cp -p .env "$BACKUP/previous.env"
printf '%s\n' "$OLD $TARGET" > "$BACKUP/additive-release"
pm2 describe engineer-cafe > "$BACKUP/pm2-description.txt"
git archive --format=tar.gz "$OLD" > "$BACKUP/previous-code.tar.gz"
git show "$TARGET:scripts/rollback-cafe-release.sh" > "$BACKUP/rollback.sh"
git show "$TARGET:scripts/deploy-mobile-polish.sh" > "$BACKUP/deploy-reviewed.sh"
chmod 700 "$BACKUP/rollback.sh"
BACKUP_READY=0
STOP_REQUESTED=0
on_error() {
  code=$?
  trap - EXIT
  if [ "$code" -eq 0 ]; then return; fi
  if [ "$BACKUP_READY" -eq 1 ]; then
    echo "Release failed. Restoring the saved code and build."
    bash "$BACKUP/rollback.sh" "$BACKUP" || echo "Automatic recovery needs inspection: bash '$BACKUP/rollback.sh'"
  elif [ "$STOP_REQUESTED" -eq 1 ]; then
    # No working files have changed while the backup is being taken.
    pm2 restart engineer-cafe || echo "Inspect engineer-cafe in PM2."
  fi
  echo "Backup directory: $BACKUP"
  exit "$code"
}
trap on_error EXIT
STOP_REQUESTED=1
pm2 stop engineer-cafe
if pm2 describe engineer-cafe-notifications >/dev/null 2>&1; then pm2 stop engineer-cafe-notifications; fi
if [ -n "$HOUSE_THEME" ]; then
  docker exec -i infra-postgres-1 sh -lc 'exec psql -XqAt -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d engineer_cafe' > "$BACKUP/previous-theme" <<'SQL'
SELECT theme FROM public."CafeSetting" WHERE id = 1;
SQL
  case "$(cat "$BACKUP/previous-theme")" in chai|midnight|matcha|saffron|gulabi|graphite|ocean|royal|terracotta|espresso) ;; *) echo "Stored theme needs inspection"; exit 1 ;; esac
fi
# Stop the cafe briefly so its build and uploaded files cannot change mid-copy.
# pg_dump is a consistent snapshot of ONLY the cafe database, never other apps.
docker exec infra-postgres-1 sh -lc \
  'exec pg_dump -U "${POSTGRES_USER:-postgres}" -d engineer_cafe -Fc' > "$BACKUP/database.dump"
test -s "$BACKUP/database.dump"
docker exec -i infra-postgres-1 pg_restore --list < "$BACKUP/database.dump" > /dev/null
tar -czf "$BACKUP/dependencies.tar.gz" node_modules
tar --exclude='.next/cache' -czf "$BACKUP/build.tar.gz" .next
if [ -d public/uploads ]; then
  tar -czf "$BACKUP/uploads.tar.gz" public/uploads
else
  tar -czf "$BACKUP/uploads.tar.gz" --files-from /dev/null
fi
for archive in previous-code.tar.gz build.tar.gz uploads.tar.gz dependencies.tar.gz; do
  tar -tzf "$BACKUP/$archive" > /dev/null
done
(
  cd "$BACKUP"
  sha256sum previous-commit target-commit app-path additive-release previous.env pm2-description.txt previous-code.tar.gz build.tar.gz uploads.tar.gz dependencies.tar.gz database.dump rollback.sh deploy-reviewed.sh > SHA256SUMS
  if [ -f previous-theme ]; then sha256sum previous-theme >> SHA256SUMS; fi
  sha256sum --status --check SHA256SUMS
)
printf '%s\n' "Backup completed $(date -u +%FT%TZ)" > "$BACKUP/backup-complete"
BACKUP_READY=1
link_tmp="$BACKUP_ROOT/.latest-$(basename "$BACKUP")"
ln -s "$BACKUP" "$link_tmp"
mv -Tf "$link_tmp" "$BACKUP_ROOT/latest"
echo "PASS: verified code, build, .env, uploads and cafe database backups saved."
echo "Backup directory: $BACKUP"
echo "Manual rollback: bash '$BACKUP/rollback.sh'"
if [ -n "$HOUSE_THEME" ]; then
  docker exec -i infra-postgres-1 sh -lc 'exec psql -Xq -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d engineer_cafe -v cafe_theme="$1"' -- "$HOUSE_THEME" <<'SQL'
UPDATE public."CafeSetting" SET theme = :'cafe_theme' WHERE id = 1;
SQL
  echo "PASS: shared storefront/admin house theme selected."
fi
pm2 restart engineer-cafe
curl --retry 10 --retry-connrefused --retry-delay 2 --max-time 30 --fail --silent --show-error \
  http://127.0.0.1:3100/admin/login -o /dev/null
CAFE_RELEASE_SNAPSHOT="$BACKUP" bash "$BACKUP/deploy-reviewed.sh" "$TARGET"
# These checks belong inside this wrapper's recovery boundary.
curl --fail --silent --show-error --max-time 30 --resolve esellerstore.vip:443:127.0.0.1 \
  https://esellerstore.vip/ -o "$BACKUP/home-after.html"
grep -q 'cinema-hero' "$BACKUP/home-after.html"
for route in /discover /compare /api/storefront-selection; do
  status=$(curl --silent --show-error --max-time 30 --resolve esellerstore.vip:443:127.0.0.1 \
    -o /dev/null -w '%{http_code}' "https://esellerstore.vip$route")
  if [ "$status" != 200 ]; then echo "Route check failed: $route HTTP $status"; exit 1; fi
done
for asset in chai-cup.webp chai-splash.webp chai-stream.webp ice-cube.webp cafe-atmosphere.webp ingredient-atlas.webp ingredient-extras.webp; do
  curl --fail --silent --show-error --max-time 30 --resolve esellerstore.vip:443:127.0.0.1 \
    "https://esellerstore.vip/experience/$asset" -o "$BACKUP/$asset"
  cmp "$APP/public/experience/$asset" "$BACKUP/$asset"
done
trap - EXIT
echo "PASS: reference storefront live — https://esellerstore.vip"
echo "Retained backup: $BACKUP"
echo "Manual rollback: bash '$BACKUP/rollback.sh'"
echo "Latest backup rollback: bash '$BACKUP_ROOT/latest/rollback.sh'"

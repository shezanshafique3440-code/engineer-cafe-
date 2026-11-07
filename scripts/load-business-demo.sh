#!/usr/bin/env bash
# Backup first; imports synthetic records only after explicit user authorization.
# Existing compiled app/code/env/uploads are not replaced or rebuilt.
set -euo pipefail
umask 077
export PATH="/opt/node22/bin:$PATH"
APP=${CAFE_APP_DIR:-/var/www/engineer-cafe}
TARGET=${1:?Supply the reviewed demo-tools commit}
[[ "$TARGET" =~ ^[0-9a-f]{40}$ ]]
cd "$APP"
APP=$(pwd -P)
if [ ! -s .env ] || [ ! -s .next/BUILD_ID ] || [ ! -f src/server/business/core.ts ] || [ ! -f node_modules/tsx/package.json ]; then
  echo "The accounting website release is not fully installed. Finish that deployment first, then run this demo loader."
  exit 1
fi
git cat-file -e "$TARGET:scripts/business-demo-data.ts"
# The importer relies on the accounting services tested for this release.
BASE=78364cda44f966c1fcc088760586d93f87985c0c
if ! git diff --quiet "$BASE" -- prisma/schema.prisma src/server/business src/server/loyalty.ts src/lib/business-math.ts; then
  echo "Accounting code differs from the reviewed demo loader. Send this output for inspection."
  exit 1
fi
running() { pm2 pid "$1" 2>/dev/null | awk '$1 ~ /^[0-9]+$/ && $1>0 {found=1} END {exit !found}'; }
if ! running engineer-cafe; then
  echo "The cafe app is not running. Finish or inspect the website deployment first."
  exit 1
fi
WORKER_RUNNING=0
if running engineer-cafe-notifications; then WORKER_RUNNING=1; fi
ROOT=${CAFE_BACKUP_ROOT:-/var/backups/engineer-cafe}
mkdir -p "$ROOT"
chmod 700 "$ROOT"
BACKUP=$(mktemp -d "$ROOT/demo-data-$(date -u +%Y%m%d-%H%M%S).XXXXXXXX")
mkdir "$BACKUP/runner"
for file in business-demo.cjs business-demo-data.ts; do
  git show "$TARGET:scripts/$file" > "$BACKUP/runner/$file"
done
printf '%s\n' "$(git rev-parse HEAD)" > "$BACKUP/app-commit"
printf '%s\n' "$TARGET" > "$BACKUP/importer-commit"
cp -p .env "$BACKUP/previous.env"
STOP_REQUESTED=0
finish() {
  code=$?
  trap - EXIT
  if [ "$STOP_REQUESTED" -eq 1 ]; then
    pm2 restart engineer-cafe || { echo "Inspect engineer-cafe in PM2."; code=1; }
    if [ "$WORKER_RUNNING" -eq 1 ]; then pm2 restart engineer-cafe-notifications || code=1; fi
  fi
  echo "Demo-data backup: $BACKUP"
  if [ "$code" -ne 0 ]; then
    echo "Demo loading did not finish. A failed import transaction rolls back its changes; no old database dump was imported. Send the output."
  fi
  exit "$code"
}
trap finish EXIT
STOP_REQUESTED=1
pm2 stop engineer-cafe
if [ "$WORKER_RUNNING" -eq 1 ]; then pm2 stop engineer-cafe-notifications; fi
docker exec infra-postgres-1 sh -lc \
  'exec pg_dump -U "${POSTGRES_USER:-postgres}" -d engineer_cafe -Fc' > "$BACKUP/database-before-demo.dump"
test -s "$BACKUP/database-before-demo.dump"
docker exec -i infra-postgres-1 pg_restore --list < "$BACKUP/database-before-demo.dump" > /dev/null
(
  cd "$BACKUP"
  sha256sum app-commit importer-commit previous.env database-before-demo.dump runner/business-demo.cjs runner/business-demo-data.ts > SHA256SUMS
  sha256sum --status --check SHA256SUMS
)
echo "PASS: pre-demo database and environment backup verified."
# Load the existing credentials without printing or replacing them.
set -a
source .env
set +a
export CAFE_DEMO_SOURCE="$BACKUP/runner/business-demo-data.ts"
export TSX_TSCONFIG_PATH="$APP/tsconfig.json"
node "$BACKUP/runner/business-demo.cjs" --apply 2>&1 | tee "$BACKUP/import.log"
echo "PASS: DEMO records loaded; the existing website build, menu and credentials were preserved."
echo "Open https://esellerstore.vip/admin/business and refresh."
echo "Search DEMO in Orders/Customers; set the report range to the last 30 days."

#!/usr/bin/env bash
# Standalone: copied into each protected backup before deployment starts.
# Restore code/build only. Keep current .env, database, orders and uploads.
set -euo pipefail
umask 077
export PATH="/opt/node22/bin:$PATH"
BACKUP=${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)}
BACKUP=$(cd "$BACKUP" && pwd -P)
test -f "$BACKUP/backup-complete"
(cd "$BACKUP" && sha256sum --status --check SHA256SUMS)
APP=$(cat "$BACKUP/app-path")
PREVIOUS=$(cat "$BACKUP/previous-commit")
[[ "$PREVIOUS" =~ ^[0-9a-f]{40}$ ]]
cd "$APP"
CURRENT=$(git rev-parse HEAD)
git cat-file -e "$PREVIOUS^{commit}"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Tracked local edits found; rollback stopped so they can be preserved."
  exit 1
fi
if ! git diff --quiet "$CURRENT" "$PREVIOUS" -- package.json package-lock.json prisma/schema.prisma prisma/migrations; then
  echo "Dependency/database versions differ; inspect before restoring an older build."
  exit 1
fi
test -f .env
pm2 describe engineer-cafe >/dev/null
RECOVERY=$(mktemp -d "$BACKUP/rollback-attempt.XXXXXXXX")
printf '%s\n' "$CURRENT" > "$RECOVERY/replaced-commit"
cp -p .env "$RECOVERY/current.env"
mkdir "$RECOVERY/restored"
tar -xzf "$BACKUP/build.tar.gz" -C "$RECOVERY/restored"
test -s "$RECOVERY/restored/.next/BUILD_ID"
set -a
source .env
set +a
STOP_REQUESTED=0
BUILD_MOVED=0
RESTORED_BUILD=0
recover_failed_rollback() {
  code=$?
  trap - EXIT
  if [ "$code" -eq 0 ]; then return; fi
  if [ "$STOP_REQUESTED" -eq 1 ]; then
    pm2 stop engineer-cafe || true
    git switch --detach "$CURRENT" || echo "Inspect code checkout: $CURRENT"
    if [ "$RESTORED_BUILD" -eq 1 ] && [ -e .next ]; then
      mv .next "$RECOVERY/failed-restored-build" || true
    fi
    if [ "$BUILD_MOVED" -eq 1 ]; then
      mv "$RECOVERY/replaced-build" .next || echo "Inspect the saved build in $RECOVERY"
    fi
    pm2 restart engineer-cafe --update-env || true
  fi
  echo "Rollback did not finish. Original snapshot retained: $BACKUP"
  echo "Recovery files: $RECOVERY"
  exit "$code"
}
trap recover_failed_rollback EXIT
STOP_REQUESTED=1
pm2 stop engineer-cafe
if [ -e .next ]; then
  mv .next "$RECOVERY/replaced-build"
  BUILD_MOVED=1
fi
git switch --detach "$PREVIOUS"
mv "$RECOVERY/restored/.next" .next
RESTORED_BUILD=1
pm2 restart engineer-cafe --update-env
curl --retry 10 --retry-connrefused --retry-delay 2 --max-time 30 --fail --silent --show-error \
  http://127.0.0.1:3100/admin/login -o /dev/null
curl --fail --silent --show-error --max-time 30 --resolve esellerstore.vip:443:127.0.0.1 \
  https://esellerstore.vip/ -o /dev/null
pm2 save
trap - EXIT
echo "PASS: previous code and build restored: $PREVIOUS"
echo "Current database, orders, uploads and .env were kept."
echo "Original snapshot is still available: $BACKUP"
echo "Replaced code/build recovery files: $RECOVERY"

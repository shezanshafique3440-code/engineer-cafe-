#!/usr/bin/env bash
# Quiesced backup of this cafe only. No retention deletion and no secret output.
set -euo pipefail
umask 077
export PATH="/opt/node22/bin:$PATH"
APP=${CAFE_APP_DIR:-/var/www/engineer-cafe}
ROOT=${CAFE_BACKUP_ROOT:-/var/backups/engineer-cafe}
cd "$APP"
test -s .env
DB_NAME=$(node --env-file=.env -e 'try { const u=new URL(process.env.DATABASE_URL); const name=decodeURIComponent(u.pathname.slice(1)); if(!["engineer_cafe","engineer_cafe_client"].includes(name)) throw Error(); process.stdout.write(name); } catch { console.error("Backup stopped: check the private DATABASE_URL; only cafe databases are supported."); process.exit(1); }')
mkdir -p "$ROOT"
chmod 700 "$ROOT"
exec 9>"$ROOT/.scheduled-backup.lock"
flock -n 9 || { echo "A cafe backup is already running."; exit 1; }
DEST=$(mktemp -d "$ROOT/scheduled-$(date -u +%Y%m%d-%H%M%S).XXXXXXXX")
running() { pm2 pid "$1" 2>/dev/null | awk '$1 ~ /^[0-9]+$/ && $1>0 {found=1} END {exit !found}'; }
APP_WAS_RUNNING=0
WORKER_WAS_RUNNING=0
DEMO_WAS_RUNNING=0
running engineer-cafe && APP_WAS_RUNNING=1
running engineer-cafe-notifications && WORKER_WAS_RUNNING=1
running engineer-cafe-demo-worker && DEMO_WAS_RUNNING=1
restore_services() {
  code=$?
  trap - EXIT
  if [ "$APP_WAS_RUNNING" -eq 1 ]; then pm2 restart engineer-cafe >/dev/null || code=1; fi
  if [ "$WORKER_WAS_RUNNING" -eq 1 ]; then pm2 restart engineer-cafe-notifications >/dev/null || code=1; fi
  if [ "$DEMO_WAS_RUNNING" -eq 1 ]; then pm2 restart engineer-cafe-demo-worker >/dev/null || code=1; fi
  if [ "$code" -ne 0 ]; then echo "Backup failed; inspect services. Incomplete backup: $DEST"; fi
  exit "$code"
}
trap restore_services EXIT
if [ "$APP_WAS_RUNNING" -eq 1 ]; then pm2 stop engineer-cafe >/dev/null; fi
if [ "$WORKER_WAS_RUNNING" -eq 1 ]; then pm2 stop engineer-cafe-notifications >/dev/null; fi
if [ "$DEMO_WAS_RUNNING" -eq 1 ]; then pm2 stop engineer-cafe-demo-worker >/dev/null; fi
# Only the active whitelisted cafe DB; no unrelated database/service is changed.
docker exec infra-postgres-1 sh -lc 'exec pg_dump -U "${POSTGRES_USER:-postgres}" -d "$1" -Fc' -- "$DB_NAME" > "$DEST/database.dump"
test -s "$DEST/database.dump"
docker exec -i infra-postgres-1 pg_restore --list < "$DEST/database.dump" >/dev/null
cp -p .env "$DEST/previous.env"
git rev-parse HEAD > "$DEST/app-commit"
printf '%s\n' "$DB_NAME" > "$DEST/database-name"
if [ -d public/uploads ]; then tar -czf "$DEST/uploads.tar.gz" -C public uploads; else tar -czf "$DEST/uploads.tar.gz" --files-from /dev/null; fi
( cd "$DEST"; sha256sum database.dump database-name previous.env app-commit uploads.tar.gz > SHA256SUMS; sha256sum --status --check SHA256SUMS )
printf '%s\n' "Verified cafe backup $(date -u +%FT%TZ)" > "$DEST/backup-complete"
echo "PASS: verified private backup: $DEST"
echo "No backups were deleted. Use verify-cafe-backup.sh to test restoration into an isolated database."

OFFSITE=false
# Optional encrypted offsite transfer. Configuration lives in a root-only file,
# never in a web request. No local backup is deleted by this step.
if [ -n "${CAFE_OFFSITE_DEST:-}" ]; then
 test -n "${CAFE_BACKUP_PASSPHRASE_FILE:-}"
 test -r "$CAFE_BACKUP_PASSPHRASE_FILE"
 [[ "$CAFE_OFFSITE_DEST" =~ ^[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+:/[a-zA-Z0-9_./-]+$ ]]
 command -v gpg >/dev/null
 ENCRYPTED="$DEST.gpg"
 tar -czf - -C "$DEST" . | gpg --batch --yes --no-symkey-cache --pinentry-mode loopback --passphrase-file "$CAFE_BACKUP_PASSPHRASE_FILE" --symmetric --cipher-algo AES256 --compress-algo none --output "$ENCRYPTED"
 scp -q -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=2 "$ENCRYPTED" "$CAFE_OFFSITE_DEST/$(basename "$DEST").gpg"
 OFFSITE=true
fi
BACKUP_HEALTH_ROOT="$ROOT" BACKUP_HEALTH_OFFSITE="$OFFSITE" node - <<'JS'
const fs=require('node:fs'),path=require('node:path');
const f=path.join(process.env.BACKUP_HEALTH_ROOT,'last-success.json');
fs.writeFileSync(f+'.tmp',JSON.stringify({completedAt:new Date().toISOString(),offsite:process.env.BACKUP_HEALTH_OFFSITE==='true'}),{mode:0o600});fs.renameSync(f+'.tmp',f);
JS

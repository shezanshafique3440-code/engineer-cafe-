#!/usr/bin/env bash
# Restore ONLY into a new temporary database, never into an active cafe database.
set -euo pipefail
umask 077
BACKUP=${1:?Supply the exact verified scheduled backup directory}
test -f "$BACKUP/backup-complete"
( cd "$BACKUP"; sha256sum --status --check SHA256SUMS; tar -tzf uploads.tar.gz >/dev/null )
CHECK_DB="cafe_restore_check_$(openssl rand -hex 6)"
[[ "$CHECK_DB" =~ ^cafe_restore_check_[0-9a-f]{12}$ ]]
CREATED=0
cleanup() {
  code=$?
  trap - EXIT
  if [ "$CREATED" -eq 1 ]; then
    docker exec infra-postgres-1 sh -lc 'exec dropdb -U "${POSTGRES_USER:-postgres}" "$1"' -- "$CHECK_DB" || code=1
  fi
  exit "$code"
}
trap cleanup EXIT
docker exec infra-postgres-1 sh -lc 'exec createdb -U "${POSTGRES_USER:-postgres}" "$1"' -- "$CHECK_DB"
CREATED=1
docker exec -i infra-postgres-1 sh -lc 'exec pg_restore -U "${POSTGRES_USER:-postgres}" --no-owner --no-privileges --exit-on-error -d "$1"' -- "$CHECK_DB" < "$BACKUP/database.dump"
docker exec -i infra-postgres-1 sh -lc 'exec psql -X -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d "$1"' -- "$CHECK_DB" <<'SQL'
DO $$ BEGIN
 IF EXISTS (SELECT j.id FROM "BusinessJournal" j LEFT JOIN "BusinessPosting" p ON p."journalId"=j.id GROUP BY j.id HAVING COUNT(p.id)=0 OR SUM(p.debit-p.credit)<>0) THEN
  RAISE EXCEPTION 'Restored accounting entries do not balance';
 END IF;
END $$;
SELECT (SELECT COUNT(*) FROM "Order") AS orders, (SELECT COUNT(*) FROM "BusinessJournal") AS journals, (SELECT COUNT(*) FROM "Ingredient") AS ingredients;
SQL
echo "PASS: backup restored and accounting balances checked in an isolated temporary database; live data was untouched."

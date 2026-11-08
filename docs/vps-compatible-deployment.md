# Compatible VPS permissions release

Base: `7426aaf3c7e25bfea4d6dcf76adbe7b5c46bc212`, the already deployed `codex/mobile-admin-polish` branch. The earlier parallel implementation commit `3e92ed5` is not a release target for this VPS: its operations schema and code diverge from the existing accounting app. This release extends the deployed implementation, retaining the storefront, notifications, POS, paise-based accounting, stock/purchases, payroll, tables, riders, approvals, reports, offline queue and all seven original migrations.

## Changes

- Unassigned/unknown STAFF profiles fail closed rather than inheriting broad admin, settings and catalogue access. An owner assigns a real profile under Cafe business system → Opening setup & access.
- Existing valid profiles retain their capabilities. The additive migration `20261108170000_individual_staff_permissions` adds two defaulted columns to `StaffAccess`. No data is deleted or re-seeded. No opening balances, accounting activation, staff identities or demo data are changed.
- The owner can opt a particular login into individual permission checkboxes. These restrict the selected profile's ceiling: an empty checked set denies all access. Disabling custom restrictions restores that profile's standard grants. Staff cannot grant themselves access or gain owner-only payroll, setup or ledger permissions.
- Current database permissions are read on each privileged request. JWTs contain no copied grants. Login remains reachable with a stale/revoked token.
- Administrator demotion/deactivation checks run under the business transaction lock, including `isActive:false`.
- Public pickup was already pending/unpaid on the deployed branch; its existing implementation is retained and regression-tested.
- The existing backup-first release and rollback wrappers now retain the running notification worker's state and restore it after early backup failure or successful rollback. No unrelated PM2 service is stopped or restarted.

## Validation

Production build with lint/type validation, existing library tests, full business/accounting and operations HTTP suites, explicit per-user permission/revocation/pickup checks, mobile/role browser checks, and backup/rollback recovery tests were run locally with disposable databases. None of those fixtures target the live VPS database.

## Deployment

Fetch this branch's reviewed full commit and execute **its** `scripts/deploy-reference-storefront.sh`; do not bypass the wrapper with `git pull` or run scripts from an older checkout. The release policy pins the supported old schema/package hashes, new schema/migration hashes, and preserves all old migration bytes.

The wrapper takes another private backup, stops only the cafe app and notification worker as needed, applies the additive migration, validates/builds the app, verifies retained catalogue prices/images and HTTPS routes, restarts both cafe services and saves PM2 state. A failure triggers recovery of the previous code, dependencies and production build. Rollback keeps all current database rows and additive columns; it never imports the old database dump or replaces uploads/.env. A code rollback returns permissions to the old implementation; new individual restrictions are not enforced by old code, so review access if rollback is used.

The known deployment is `/var/www/engineer-cafe`, PM2 `engineer-cafe` on loopback port 3100, worker `engineer-cafe-notifications`, PostgreSQL database `engineer_cafe`, and HTTPS domain `esellerstore.vip`. The wrapper checks its required local Docker/PostgreSQL backup capability before changing the app. It does not change Nginx, DNS, credentials, themes or other websites.

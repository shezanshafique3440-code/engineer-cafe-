# Demo Data — owner guide

This release extends the audited live version `4d5d0fb`. It does not include the paused single-counter redesign. Website text remains English. Existing roles, public menu, prices, images and owner accounts are retained.

## Load test data

1. Sign in with an existing **owner / ADMIN** account.
2. Open **Demo Data** from the admin tools, or `/admin/demo-data`.
3. Stop counter entry and allow every offline counter to sync. The sample records affect the current database and reports.
4. Type `LOAD DEMO DATA`, then select **Back up and load demo data**.
5. Wait for **DONE** in Recent jobs. Saving and checkout are paused during the job. Reads remain available where they do not wait on the accounting lock.
6. Open **Cafe business system**. Set the report dates to the last 30 days to see the complete sample history.

The additional batch contains:

| Module | Additional samples |
| --- | ---: |
| Orders | 2,000 |
| Riders | 25 |
| Customers | 100 |
| Employees | 30 |
| Ingredients | 40 |
| Suppliers | 12 |
| Tables | 15 |
| Attendance | 900, when all 30 accounting dates are open |
| Purchases | Up to 30, plus returns and part payments |
| Payroll | Up to 30, depending on open accounting dates |
| Purchase orders | 9 drafts/approvals/cancellations |
| Stock counts | 6 drafts/posts/cancellations |
| Refund approvals | 3, tied to an actual sample refund due |
| Coupons | 30 inactive, so public checkout is unaffected |
| Reviews | 48 pending reviews of hidden sample products |
| Addresses | 100 synthetic addresses |
| Messages | 20 clearly labelled sample enquiries |

There are cash shifts, expenses, customer balances, pending table bills, cash collections, commissions and reversals. Samples use the same stock and accounting services as actual operations. Closed accounting dates are never reopened; the seed compresses the sample activity into available open dates.

## What to test

- **Orders / Kitchen:** find `DEMO2` tickets and move the active samples through preparation and handover. Unpaid demo pickup handovers use their demo drawer; delivery cash uses the rider control account.
- **Riders & deliveries:** inspect assigned tickets, delivery history, 15% commission, partial/full payouts, cash held, remittances and reversals. Use a DEMO bank/cash account for test payouts or collections.
- **Ingredients & stock / Recipes:** view sample recipes, quantities, reservations, low-stock examples and usage.
- **Purchases / Supplier balances:** view paid, part-paid and unpaid invoices and returns. Test the sample draft purchase orders.
- **Employees / Attendance / Payroll:** review attendance states, overtime, advances, posted salaries, drafts and payments.
- **Cash shifts / Financial reports:** compare demo cash, bank and wallet activity, customer dues, expenses and balanced journal entries. Use the last 30 days, rather than today alone.
- **Approvals / Stock counts:** review the labelled draft examples. No stock count fabricates a physical variance.
- **Coupons / Reviews / Messages:** inspect the inactive/pending sample website records. They are not real customer feedback or enquiries.
- **Offline counter:** offline behaviour must be tested on the actual counter device. This seed does not put fabricated pending sales in a browser's offline queue or claim that a sync happened. Manually entered orders are preserved unless their provenance is proven; cleanup blocks any mixed relationship.

The demo menu category is hidden from the public menu. Existing public products remain usable. This release does not introduce a separate training login or silently classify every newly entered order as fake. For ordinary counter/POS/offline testing, records created manually need to be reviewed separately if they touch demo stock. Never assume that the reset removes all manual test activity.

## Reset after testing

1. Stop test activity. Sync or discard training-only pending offline sales on **every device** before resetting. The server cannot clear a disconnected browser's queue.
2. Select **Preview cleanup**. Review the module counts and blockers.
3. If blocked, reconcile the listed genuine/demo links first. Unregistered financial stock entries need proven importer provenance; using a DEMO ingredient alone does not make an actual physical stock entry fake. Do not bypass a blocker by disabling constraints, deleting journals, reopening periods or running the generic Prisma seed.
4. If the preview is correct, type `RESET DEMO DATA` and select **Back up and reset listed demo data**.
5. Wait for **DONE**. The preview is checked again while writes are stopped. A changed preview or failed backup prevents deletion.
6. Open **Recipes & costing**. Known assumed practice recipes are preserved, moved to clean ingredient masters and marked **Review required**. Confirm real quantities and save each recipe. Newly created ingredient masters start at **zero quantity and zero value**; an existing matching genuine ingredient retains its actual balance.
7. Enter actual opening stock through the normal stock workflow, reconcile money/customer/supplier balances, and review any manually created records before live business starts.

The 600 old deterministic demo orders are included only when the known `business-demo-v1` receipt exists. The 35 real-menu recipes from the known practice importer are converted only when their original assumed/test provenance remains identifiable. Changed or ambiguous recipes block reset. The other 11 pre-existing orders are preserved; their authenticity is not inferred.

## Server administrator

- Dedicated process: `engineer-cafe-demo-worker`, script `scripts/demo-manager.cjs`, cwd `/var/www/engineer-cafe`.
- Standard operation: `node scripts/demo-manager.cjs`; one tick for diagnosis: `node scripts/demo-manager.cjs --once`.
- The CLI loads `.env` privately. Do not paste `.env`, PM2 JSON or backup dumps into chat.
- Default private backups: `/var/backups/engineer-cafe/demo-manager/<job-id>/database.dump` and `sha256.txt` (directory mode 700, dump mode 600).
- Production backup uses the existing `infra-postgres-1` container. The connection must point to local PostgreSQL database `engineer_cafe`. Different database/container names require an explicit code review, not a fallback to some other database.
- The archive must pass `pg_restore --list`; SHA-256 is retained with the job. Restore is a separate administrator operation and is never automatic.
- Restart the same worker after a crash. Its transaction mutex prevents overlapping workers. Pending jobs are durable, seed receipts prevent duplicates, and completed cleanup/status/maintenance release commit atomically. Do not manually clear maintenance while a job could still be running.
- If a job fails, inspect `pm2 logs engineer-cafe-demo-worker --lines 80 --nostream`. Correct the cause, review a fresh preview, and queue a new job. Never edit live immutable records to make reset pass.
- Keep enough disk space for a release archive and at least two database dumps. Existing private backups are not deleted by reset.

`./scripts/deploy-demo-manager.sh <reviewed-full-commit>` installs the tools with a private release backup and recovery of the previous build if deployment fails. It does **not** seed or reset. It stops only the cafe processes and leaves the VPS's other applications untouched. The migration adds demo tables/guards and a recipe review flag; normal financial updates/deletes stay immutable. Cleanup has only an exact current-row DELETE permit inside the active, verified-backup job. Triggers are never globally disabled.

## Validation

Use a fresh local disposable `cafe_demo_cleanup_test` database only. Apply migrations, then run `scripts/tests/demo-manager.cjs` with local PostgreSQL dump/restore binaries and `CAFE_DEMO_BACKUP_DRIVER=local`. The test entry point refuses other databases. The browser suite is `scripts/tests/demo-manager-browser.cjs`, against a local production server on port 4185 with the same test `.env`.

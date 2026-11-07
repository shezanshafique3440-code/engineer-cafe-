# Cafe operations upgrade

This release extends the existing accounting-aware cafe app. It does not seed the production database, change storefront themes, alter prices, change login credentials or switch the active client database.

## Daily cash closing

Cafe office → Cash shifts supports entering a physical total or counting Pakistani notes/coins. The server recomputes the denomination total, compares it to the current drawer balance, requires a reason for a difference and posts the difference once. Closing stores the cashier, closer, expected cash, actual cash and denomination evidence. A manager or owner records a subsequent review without posting the correction again. A manager cannot review their own closing; the owner can. Old closings remain unreviewed until explicitly reviewed. Closing statements print/save to PDF; the latest 100 shifts export to CSV. Closing a drawer is not a lock on the entire accounting date; the existing owner period lock remains separate.

## Supplier purchasing

Cafe office → Purchase orders records multi-ingredient commitments, agreed quantities/costs and expected delivery dates. Drafts have no cash, stock or ledger effect. A manager/owner approves or cancels them. Full receipt of an approved commitment calls the existing invoice service, adds stock, records supplier dues and optionally records the actual payment. An invoice links back to its purchase order; retries do not double-receive. A changed/short delivery must be entered as its actual invoice through Purchases after cancelling the old commitment; partial purchase-order receipt is not implemented. Existing invoice returns, supplier advances, payments and balances continue to work.

## Physical stock counts

Cafe office → Physical stock counts accepts any subset of active ingredients. Blank quantities skip an ingredient; zero counts it as empty. A draft captures the recorded quantity, value, unit and stock version. Review shows every variance. Posting applies all differences in one transaction, respecting reserved ingredients and valuing extra stock at the entered total added value. If any stock version changed, the whole post fails without applying other lines. Discard and recount that draft. Matching quantities create no fake stock movement. Count sheets export to CSV; do the physical count while kitchen movements are paused.

## People and payroll

The existing staff, monthly/daily pay, attendance, leave, overtime, bonus/deduction, advance recovery, draft/post/pay and stale-attendance guards remain in force. Salary cards now print a salary slip and export a CSV. Draft/reversed calculations are clearly labelled and do not claim a salary liability or payment. Only owner payroll access can see these records. A slip shows the calculated payable and actual recorded payments separately.

## Table service

A cashier, manager or owner can transfer an active bill to an empty table, merge its whole bill into another open bill, or move selected whole kitchen tickets between open bills. The kitchen state, existing payments, recipe reservations and accounting references move with the tickets; no sale or stock usage is duplicated. Merging closes the emptied source session and carries its guest count forward. Splitting a single ticket into item-level sub-bills is not implemented; the existing partial cash/bank payments handle a shared payment instead. Waiters remain restricted to their assigned tables, and kitchen instructions stay on each ticket.

## Refund and discount approvals

Cashier/manager order refunds require an approval requested from the cancelled order. Owner refunds can be recorded directly with a reason. The manager/owner review screen shows the order, exact amount, requester and reason. Another manager or the owner must review a manager's own request.

Counter POS supports requesting a whole-rupee discount on the exact current cart. The request stores verified product names, quantities and subtotal for the reviewer, and binds the approval to a canonical hash of product IDs, quantities, add-ons and notes. The approved amount is applied server-side before tax. It cannot be stacked with other discounts or exceed the subtotal. Only the requesting cashier can use it, and changed carts are rejected. Requests expire 24 hours after creation. Approval itself moves no money; use is recorded once with the resulting order/refund. Transaction idempotency allows a successful request to be retried without duplicating money or consuming a second approval.

## Costs, reports and accountability

Recipes show their current effective selling price, estimated ingredient cost, ingredient margin and a configurable target-margin price suggestion. Suggestions exclude overhead/tax and never update menu prices automatically. Missing stock/recipes show an unknown cost rather than an invented zero.

Business overview adds daily net quantities, sales, food cost, gross profit and CSV export. Cash flow shows opening money, money in/out by journal source, net change and closing money across cash, bank, wallet and rider accounts. Internal transfers show both sides and net to zero. Revenue, profit and money balances stay separate. Ledger and inventory reconciliation remain exact in paise.

Change history adds date-range filtering in Pakistan time, search by staff/action/entity/record ID, 50-record pagination and CSV export of the displayed page. Every new purchasing, counting, approval, table-move and closing-review operation records its actor and reason. Product create/update/archive/delete logs include prices and stock before/after; selected public operating-setting changes (including tax/theme/logo) and order status transitions also record their actor and previous/new values. Private credentials are not copied into these audit details. Posted journals, stock movements, payments and audit rows retain their existing database immutability rules.

## Backups and deployment

The additive migration is `20261108090000_cafe_operations`. Deploy through the existing backup-first release wrapper after the reviewed code has been pushed. The release policy accepts the previous accounting schema, verifies the new schema/migration hashes and rejects edits to old migrations. No dependency changes are required. Existing rollback keeps the additive columns/tables and current data.

`scripts/backup-cafe.sh` briefly stops only previously running cafe app/notification services, takes a consistent dump of the active whitelisted cafe database (`engineer_cafe` or `engineer_cafe_client`), verifies its archive, copies `.env`, archives local uploads and records the app commit/checksums in a private directory. It restores those services even on failure. It never deletes backups. Monitor free space and copy important snapshots off the VPS; a local disk backup does not protect against loss of the whole VPS.

After deployment, explicitly run `bash scripts/install-cafe-backup-timer.sh` as root on the VPS to install this cafe's timer at **04:00 Asia/Karachi daily**. It refuses to replace an existing timer. No timer is installed by a code build. Check its state with `systemctl list-timers engineer-cafe-backup.timer` and failures with `journalctl -u engineer-cafe-backup.service`.

Test a specific scheduled snapshot with `bash scripts/verify-cafe-backup.sh /exact/private/backup/path`. It checks all hashes, restores the dump into a new randomly named `cafe_restore_check_*` database, checks posted journal balances and removes that temporary database, including on failure. It never restores into `engineer_cafe` or `engineer_cafe_client`. A real disaster restore remains a deliberate maintenance operation; uploading files from a newer point than a restored database may require reconciliation.

## Local validation

Use a fresh disposable local PostgreSQL database named `cafe_operations_test`. Set `CAFE_TEST_DATABASE=cafe_operations_test` and its explicit `DATABASE_URL`, apply migrations, then run `scripts/tests/business-fixture.cjs`. Start the app against that database only, then run the existing business regression and `scripts/tests/operations-integration.cjs` with `CAFE_BUSINESS_TEST_URL` pointing to that local app. `CAFE_TEST_PG_MODULE` may point to external test tooling's `pg` package; production dependencies are unchanged. Fixtures refuse to overwrite existing data.

After those fixtures, `scripts/tests/operations-audit.cjs` additionally verifies price/settings/status audit, discount cashier binding and tax after discount.

`scripts/tests/operations-browser.cjs` submits purchase-order, stock-count and closing forms at mobile width against the same disposable fixture.

Browser regression `scripts/tests/business-browser.cjs` covers all business sections, including the new screens, at 320, 390, 768 and 1440 pixels. Scheduled backup tests are `python -m unittest scripts.tests.test_scheduled_backup`. Physical printers and the VPS timer still need verification on their actual hardware/server; local browser/PDF tests do not prove those installations.

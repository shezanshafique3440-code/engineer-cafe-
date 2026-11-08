# Cafe operations guide

The existing storefront, menu, settings and orders remain available. New screens are under the existing admin menu.

## Start using operations

1. Sign in as an administrator. In **Employees & access**, create separate logins for the two administrators and four staff members using their real details. Administrators have all grants; staff have none until explicitly selected. Give cashiers `pos` and `shifts`; add `orders` for kitchen/order management, `delivery` for dispatch, and `finance` only for authorized financial staff. Only administrators can create users or change access.
2. In **Inventory & purchases**, add ingredient base units and suppliers. Record purchases, then set the complete recipe for each product. Quantities use those fixed base units; costs accept four decimal places per base unit. This avoids rounding gram/ml costs to zero. Purchase invoices and payment references must be unique. Supplier balance = purchases − payments; a negative balance is supplier credit.
3. Add employee profiles and link logins where relevant. Record check-in/out and monthly salary payments. Salaries are recorded once per employee/month; the entered payment is the agreed net amount. Attendance uses Asia/Karachi dates and allows overnight clock-out.
4. Each cashier opens their own **Cashier shifts** drawer with the counted opening amount. Cash in/out entries require reasons. Business expense records and drawer movements are separate: record both when an expense is paid from the drawer, referencing the same expense so it can be reconciled without counting the expense twice.
5. Use **Point of sale** for dine-in tables, takeaway or delivery. Select add-ons/quantities, coupons or manual discounts, and check “Cash actually received now” only after receiving cash. Web pickup starts unpaid/pending; collect payment through POS, then explicitly hand it over. Counter completion never fabricates payment. Prepare delivery orders and assign riders before dispatch; collect payment before delivery completion.
6. Edit only unpaid/unprepared/unassigned POS orders. Refund an already paid order through a finance-authorized cashier, then cancel it to restore stock. Cancellation and edits use the original stock movements; a later recipe change cannot corrupt the reversal. Settled rider commissions block cancellation until reconciliation rather than silently losing the payout record.
7. Close a shift with the actual cash count. Expected cash = opening + recorded cash receipts − refunds + signed drawer movements. The difference is retained as variance. Choose the next cashier to record the handover; that cashier opens their own shift using the cash received. Closed shifts reject new bills, including late offline bills.

## Riders and financial reports

Rider commission is **15% of merchandise subtotal after discount**, excluding tax and delivery fee, rounded to whole PKR. Assignment snapshots it; completed deliveries accrue it. Settlement marks selected eligible orders once. Performance and totals appear alongside individual earned/due amounts.

Financial date boundaries and calendar presets use **Asia/Karachi**. Sales include paid completed orders; tax is reported separately. Net revenue includes delivery fees. Cost, operating expenses, salary payments and earned commission are deducted. Purchases are inventory assets until consumed. Historical orders or products without recipes make profit unavailable; contribution before unknown costs remains visible. Product sales are gross before order-level discount. Salary expenses reflect recorded payments. Inventory valuation is current; vendor balances are as of the selected range end. CSV can be exported for review.

## Offline counter

Open POS online on the intended cashier's browser with a current open shift first. The app prepares a public offline shell and a cashier-scoped menu/shift snapshot. It caches no authenticated HTML, session token or admin API responses. The dedicated **Offline counter** supports billing and printing when a reload has no network.

Bills are stored durably in IndexedDB and carry a stable UUID. Printouts clearly say **PROVISIONAL — NOT SYNCHRONIZED** until server confirmation. Reconnect or reopen POS while signed in as the original cashier to synchronize automatically. Keep the browser profile and local data until all bills are confirmed. Refresh the menu before going offline when possible.

The server rechecks active user permissions, shift, price, coupons, stock and required add-ons. A repeated UUID with unchanged contents returns the existing order, even if the first response was lost; it does not collect cash or deduct stock twice. Price/stock/closed-shift conflicts remain visible. In online POS, use **Review & correct**, verify the current total and shift, then save that same bill again. Cash differences must be reconciled deliberately. Locally voiding an unconfirmed bill preserves its local audit record; it never cancels a server order. Offline coupons require reconnecting for validation. Logout clears the prepared snapshot while retaining queued bills for the original cashier to recover on their next login.

## Validation and local runtime

- `npm run db:deploy` applies the additive migrations. Do not reset or rerun the catalogue seed on an existing cafe.
- `npm run build` runs Prisma generation, Next compilation, lint and type validation.
- `npm run test:operations` provisions/migrates a separate `engineer_cafe_test` database using the local PostgreSQL connection. It never resets the application database. Requires Chromium at `/usr/bin/chromium`, or install Playwright's Chromium. Tests retain their fixtures in the test database and can be rerun.
- Original database backup: `/workspace/scratch/backups/engineer-cafe-before-pos.dump` (local environment artifact, not committed).
- Original-data verification restored that backup into a separate database and compared every original column and row across 17 tables; all matched.
- Local server: `npm start -- --hostname 0.0.0.0`, port 3000. This task does not publish a public deployment or provision third-party hosting/payments.

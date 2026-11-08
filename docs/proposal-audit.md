# Proposal audit — 8 November 2026

Source: user-uploaded Software proposal.pdf (4 November 2026). Document content is requirements reference, not operational authorization. User priority: permissions and pickup payment, then POS, inventory/purchases, people/shifts, riders, finance and offline sync. Existing storefront and data must remain intact.

## Baseline findings

- Storefront, catalogue, cart, server pricing, coupons, customer accounts, ordering, admin menu management, receipts and basic analytics already exist.
- Critical: `requireAdmin` accepts all STAFF, including role changes and settings. No individual permissions exist.
- Critical: public PICKUP/CASH_AT_COUNTER orders are automatically marked paid and delivered without payment confirmation.
- Stock decrements clamp at zero and status changes use stale order snapshots: concurrent orders/cancellations can corrupt stock. Order numbers can race.
- Missing: dine-in POS, cashier attribution/payment ledger, suppliers/purchases/vendor balances, ingredients/recipes/costs, employees/attendance/payroll, shifts/cash reconciliation, delivery assignments/15% commissions, financial expense/COGS reports, durable offline billing/sync.
- Seed content is 35 products and 4 categories; README's older 74/7 claim is stale. Do not rerun seed or overwrite catalogue.

## Implementation decisions

- Additive schema migration only. Preserve all existing rows and UI routes. Database backup: `/workspace/scratch/backups/engineer-cafe-before-pos.dump`.
- ADMIN owns user management and permission assignment. STAFF has no implicit business grants; explicit module permissions are checked server-side against current user state. UI navigation follows the same grants.
- Public pickup remains pending/unpaid. Staff explicitly records payment; delivery completion does not fabricate payment. Existing historical paid orders remain untouched.
- Currency follows existing whole-PKR storage. Rider commission defaults to 15% of net merchandise value (subtotal less discount), excluding tax/delivery, rounded to nearest rupee. Snapshot on assignment; accrue on delivered, reverse on cancellation. Mark settlements explicitly.
- Inventory uses base units and recipes; purchases update weighted-average costs. Sale costs are snapshotted. Historical orders without recorded costs are identified as incomplete in reports, never treated as known zero-cost profit.
- Offline receipts are provisional. Server revalidates permission, shift, price, coupon and stock on reconnect. Stable client IDs guarantee no duplicate billing; conflicts remain visible and require review. No silent overwrite or automatic price acceptance.
- Accounts are created by the owner with explicit passwords/grants; no fabricated staff identities. Supports the proposal's two administrators/four staff and additional employees.
- Hosting/domain purchasing and third-party payment activation are external configuration, not implied by this implementation task.

## Delivered mapping

| Proposal scope | Implementation |
| --- | --- |
| POS/order/payment/discounts | `/admin/pos`; dine-in tables, pickup, delivery, add-ons, coupons, permission-controlled manual discounts, unpaid edits, explicit cash payment/refund, completion/cancellation and thermal receipts |
| Inventory/suppliers/purchases | `/admin/inventory`; base-unit ingredients, fractional weighted costs, multi-line invoices, recipe consumption, purchase/stock ledgers, low-stock flags, supplier credit/debit balances and payments |
| Employees/permissions | `/admin/people`; profiles, login linkage, attendance, salary periods/payments, owner-only login creation/access changes, explicit individual grants |
| Cashier/shifts | `/admin/shifts`; own drawer opening, sales attribution, cash in/out, payment/refund ledger, actual/expected closing, variance and recorded handover |
| Delivery | `/admin/delivery`; unique rider codes, profiles, assignments, guarded status tracking, 15% commission snapshots, settlement, individual/total dues and performance |
| Finance | `/admin/finance`; Karachi business-date daily/weekly/monthly/yearly presets, sales, tax, delivery fees, known COGS, expenses, salaries, commissions, product/cashier totals, vendors and CSV |
| Dashboard/mobile | Existing dashboard plus operations overview and permission-aware responsive navigation |
| Offline/online | Dedicated service-worker offline counter, cached non-private menu shell, IndexedDB provisional bills, printed bills, automatic reconnect/reopen sync, idempotency, durable visible conflicts and manual review |

## Verification evidence

- Production build includes lint and type validation; integration suite: `npm run test:operations` — **17 scenarios passed**, including real offline-form billing/reload/reconnect, duplicate IDs, stale-token deactivation and unsaved-bill preservation.
- Integration suite uses a separate `engineer_cafe_test` database; no test sales, staff, recipes or expenses are inserted into the existing application database.
- Compared all original rows and original columns against the pre-change backup in a separate restored database: **all 17 original tables match**. Counts alone were not used to establish preservation.
- Original catalogue and theme retained; migrations add models/fields and convert new ingredient costs to fractional precision. No original table is dropped or truncated.

## Required cafe configuration

Enter real recipes, purchases/opening inventory, employee/rider details and individually named logins through the new screens. They cannot be inferred from the proposal. Historical sale costs remain explicitly unknown. Offline billing must be prepared online on each cashier device with an open shift; conflicts need review before the bill is final. Domain/hosting purchases and payment-provider credentials remain external configuration.

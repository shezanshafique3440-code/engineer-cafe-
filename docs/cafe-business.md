# Cafe business system

The website, counter POS, kitchen and waiter desk share the cafe's database. Accounting is **off initially**. Existing customers, orders, prices, settings, uploaded photos and logos are preserved. The homepage hero is restored to the original “Chai. Paratha. Aur Engineering Wali Vibes.” design with featured-dish photos and a carousel; the remainder of the storefront keeps its newer features and chosen house theme.

## Owner setup before the first tracked sale

Open **Admin → Cafe business → Opening setup & access**. Keep order integration off while entering real opening records. Do not seed or invent production quantities, costs or salaries.

1. Finish or cancel existing open website orders before cutover. Older orders stay in the legacy period; they are not retroactively assigned invented ingredient costs.
2. In **Ingredients & stock**, add ingredients in grams, millilitres or pieces. One kilogram is 1,000 g; one litre is 1,000 mL. Quantities support four decimal places. Enter opening quantity and **total value** for each ingredient, and a low-stock threshold.
3. In **Recipes & costing**, define ingredient quantities for each product and applicable add-on. Recipe yield supports batches: e.g. ingredients for ten cups with yield 10. Only non-food services such as packing should be exempted. The suggested food cost uses current ingredient values; it is not a selling-price change.
4. Add suppliers, approved credit customers and employees. Legacy salary dues are paid using the employee’s **Record payment → Pay legacy opening salary dues** action; new salaries are paid from their posted payroll records. Record actual joining/leaving dates, monthly salary or daily rate, overtime rate and optional separate staff logins. Owner payroll and ledger remain private. Existing STAFF accounts keep their earlier operational access until the owner assigns a narrower profile.
5. Enter outstanding supplier/customer balances, staff advances and unpaid legacy salaries in Opening setup. Record cash, bank and wallet opening funds in **Expenses & money**. Import each opening balance once; request retry protection does not prevent an intentional second entry with a new request.
6. Create tables and any additional drawers, bank or wallet accounts. Open a cash shift using the counted cash that matches the recorded drawer balance. The owner can record a reasoned cash correction if counts disagree.
7. Review readiness, then **activate order integration**. New website, counter and table orders now reserve ingredients and post their real financial events. Opening entries close after activation. Finish open tracked tickets and all their balances/refunds before pausing integration.

## Daily operation

- **Counter POS:** live menu/add-ons, cash tender/change in paise, bank/wallet receipts, approved customer credit, thermal receipts. Bank/wallet amounts cannot include cash change. A cash drawer requires an open shift.
- **Tables & waiters:** create/open a bill, assign a waiter, add separate kitchen tickets to the same table, prepare/serve tickets, receive split or partial payments and print a combined bill. Bills close only after all tickets are served/cancelled and payments/refunds settled.
- **Kitchen:** preparation consumes the ingredient quantities reserved when the order was placed. Later recipe edits affect future orders. Chef accounts prepare food; cashiers/managers handle financial transitions. A waiter can serve their own ready table tickets.
- **Purchases & suppliers:** supplier invoice, quantities, total ingredient costs, immediate or later payment, supplier advance/credit, returns and actual supplier refunds. Return quantities cannot exceed the unreturned invoice quantity or consume stock reserved for orders.
- **Ingredients:** on-hand, reserved and available quantities; low-stock alerts; opening, purchase, count, waste, staff meal and adjustment history. Physical counts require a fresh version. Reserved ingredients cannot be archived or taken away from pending tickets.
- **Expenses & money:** rent, gas, electricity, packaging, delivery, repairs, other costs, owner investment/withdrawal, account transfers and cash differences. Supplier payments, salary payments and owner withdrawals are not mistaken for fresh operating expenses.
- **Cash shifts:** opening count, current balance, counted closing balance, over/short explanation and retained shift history. Actual closing differences post to the ledger. Money reversals reference the current cash shift, not a previously closed shift.
- **Credit collections:** approved limits account for outstanding invoices and pending credit tickets. Receipts allocate to delivered outstanding orders oldest first, including a final single paisa. Unpaid orders do not earn loyalty credit merely because they were served.

## Accounting rules

All posted amounts use exact integer-paisa arithmetic and PostgreSQL Decimal columns. Moving-average ingredient costing conserves the recorded total value down to the final paisa. A purchase return removes current moving-average stock cost; any difference from the original supplier credit posts separately as return variance. Backdated entries retain the stock valuation calculated when they are posted; they do not recalculate earlier sales.

Ingredients are reserved on acceptance, consumed into food-in-preparation when cooking starts, then transferred to cost of food sold on handover. Revenue is recorded on handover/serving, not when an unpaid cart or kitchen ticket is created. Customer deposits, unpaid credit, delivery income, collected tax and cash/bank movements remain separate accounts.

Cancelling an uncooked ticket releases reservations. Cancelling prepared food records wastage and does not put cooked ingredients back into raw stock. Cancelling an already served sale reverses its sales/cost entries and records the prepared-food waste. Cancellation does **not** pretend that cash was refunded: the owner/cashier records each actual refund separately. Partial payments/refunds remain visible on the order and receipt. Accounting orders cannot be permanently deleted; correct them with cancellations or linked reversals. Historical legacy order deletion keeps its earlier administrator-only behavior.

**Business overview** provides date-range revenue, food cost, gross/net profit, item quantities, item cost, margin and markup, with CSV export. Margin is profit ÷ sale; markup is profit ÷ cost, so both are labeled separately. **Ledger & balances** includes a trial balance, party balances and recent journal lines. Item totals cover the selected range without a row cap; detailed lists explicitly show recent records (journals 200, stock movements 100, purchase/payroll lists 200). Dates use Pakistan time. Closed accounting dates cannot be silently reopened; correct errors in an open period with a reason.

Every transaction must actually be recorded to make the books complete. For example, rider cash stays in the rider account until transferred, and unentered rent or electricity cannot appear in net profit automatically. This is an internal cafe management ledger; statutory tax filing, bank reconciliation imports, biometric attendance and automatic bank/WhatsApp integrations are not included.

## Employees and payroll

Monthly pay is prorated using the calendar month's days and employment dates. Absent/unpaid leave deducts a day, half-day deducts half, and approved overtime uses the recorded rate. Unmarked monthly attendance is paid by this policy and must be explicitly acknowledged before posting. For daily-rate employees, only recorded paid days/half-days count. Bonuses and manual deductions are separate; advance recovery cannot exceed earned pay.

Draft payroll shows its full calculation using the reviewed contract rate at draft time. Already posted payroll retains its rate snapshot; a later contract edit does not rewrite paid salaries. Changes to salary, attendance or advance balances make the draft stale and require recalculation. Posted periods cannot overlap for an employee. Salary expense accrues on the period's end date; advance recovery posts on the actual posting date, and bank/cash payments post when paid. A paid payroll must have its payment reversed before the payroll itself can be reversed. Former employees remain selectable for final pay periods. Attendance supports actual Pakistan-time clock-in/out, including overnight shifts; overtime remains an explicitly approved input, not a claim calculated from a clock alone.

| Profile | Access |
| --- | --- |
| Owner / ADMIN | All modules, payroll, opening balances, ledger, period closing and access setup |
| Manager | Operations, recipes/stock, purchases, expenses, attendance and operating reports; no owner payroll/ledger |
| Cashier | Counter orders, receipts/refunds, tables and own cash shift; no salaries or ingredient costs |
| Waiter | Assigned table tickets and serving; no payments, payroll or ledger |
| Chef | Kitchen and ingredient quantities; no salaries, payments or ingredient values |

Authentication rechecks the database role/profile for API requests. Hidden navigation is not the permission boundary.

## Release and rollback

Use the existing backup-first deployment wrapper with the final reviewed commit after it has been pushed. The release adds an additive migration; it does not reseed production or replace `.env`/uploads. The wrapper accepts the reviewed original baseline and the previous experience release, and rejects unknown package/schema/migration changes. It verifies backup archives and database dump before deploying.

The standalone rollback preserves later orders, uploads, `.env` and all additive database records; it does not import an old database dump. **Once accounting is active, a downgrade to code without the accounting services is blocked before stopping the app.** Settle tracked tickets, dues and refunds and pause integration before such a downgrade. An additional database guard rejects legacy code changing tracked orders. Upgrades between accounting-aware releases retain the ledger normally.

## Verification

- Pure tests: `node --import tsx --test src/lib/__tests__/*.test.ts`.
- Types/lint/build: `npm run typecheck`, `npm run lint`, `npm run build`.
- Release snapshots and rollback: `python -m unittest scripts.tests.test_release_backup`.
- Real API/accounting regression: `scripts/tests/business-integration.cjs`, **only with the dedicated disposable local `cafe_business_test` fixture**. Requires `pg` accessible to Node (or `CAFE_TEST_PG_MODULE` pointing to that package) and the fixture described below. `CAFE_BUSINESS_TEST_URL` defaults to `http://localhost:4175` and rejects non-local hosts.

The isolated fixture needs the app's migrations applied to `cafe_business_test`, database user `agent`, settings id 1 with minOrderAmount 0, products `business-chai` (150), `business-paratha` (200), `business-service` (20, recipeRequired false) in an available category, and an ADMIN account `business-owner@example.test` with disposable password `Business-QA-123!`. Start the test app against that database only. Every run requires a fresh database because posted ledgers are intentionally immutable. Never create these fixtures or run this regression against the live cafe database.

For a developer with local PostgreSQL and an empty test database:

```bash
# This database name is deliberately fixed by both fixture and integration guards.
createdb -h 127.0.0.1 -U agent cafe_business_test
export DATABASE_URL='postgresql://agent@127.0.0.1:5432/cafe_business_test'
npm run db:deploy
node scripts/tests/business-fixture.cjs
npm run dev -- --hostname 127.0.0.1 --port 4175
# In a second terminal with pg installed for test tooling:
node scripts/tests/business-integration.cjs
```

The fixture refuses to overwrite existing accounts or any posted business ledger. A rerun needs a newly created disposable database. Production installation does not run either test script.

With the isolated fixture running, browser regression is available as `node scripts/tests/business-browser.cjs` using separate Playwright test tooling. Set `CAFE_TEST_PLAYWRIGHT_MODULE` / `CAFE_TEST_CHROMIUM` when the runner supplies those tools outside the project. It checks every business panel at 320, 390, 768 and 1440 pixels, submits a supplier form, verifies the original hero and checks staff navigation. Screenshots go to `/tmp/cafe-business-browser` by default (`CAFE_TEST_ARTIFACTS` can override this).

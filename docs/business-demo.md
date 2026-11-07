# Existing-website DEMO dataset

The owner explicitly chose **DEMO records inside this website**, rather than a separate demo copy. This loader adds synthetic transactions to the existing cafe database. These entries therefore count in business reports. They are recognisable by `DEMO ·` names, `DEMO1000…` receipt numbers, `DEMO-` employee/invoice codes, deterministic `cafe-demo-v1-` IDs and a retained import audit record.

The default sample covers the last 30 open accounting days and includes:

- 600 orders with multiple items: paid, credit, part-paid, pending, preparing, ready, out for delivery and cancelled, with receipts/refunds and split table payments.
- 45 fictional customer accounts/credit parties, 12 employees, up to 360 attendance records, salary drafts, posted payroll, full/partial salary payments and outstanding advances.
- 24 ingredients, opening quantities/values, 24 sample product recipes, supplier purchases/returns, spoilage, staff meals and low-stock examples.
- 7 suppliers, 8 tables, current table bills, cash/bank/wallet accounts, cash-shift history, expenses and cash over/short examples.

A closed accounting period truncates the date range; it is never unlocked. Records dated before the cutover are not modified. New sample recipes use only separate `DEMO` ingredients. The training product category is inactive, so synthetic items do not appear in the public storefront or replace its real menu, hero, photos or prices. Existing customer/staff passwords are untouched. Fictional customer passwords are random and never displayed. No staff login credentials are created. No email, WhatsApp or push jobs are sent for sample orders.

The importer uses the existing reservation, weighted-average inventory, invoice, refund, supplier-payment and payroll services. Its CLI-only date adapter dates synthetic financial entries consistently with their historical sample orders. Normal app requests and their dates are unchanged. Journal/audit creation times retain when the import actually occurred.

The entire import runs in **one transaction** under the accounting advisory lock. Failure rolls back the sample import. Completion is recorded as `BusinessRequest.key = business-demo-v1`. Running it again returns the existing summary without duplicating any records. Import completion checks protect the original menu, users, orders, integration/period settings and cash/bank accounts, and reconcile inventory, work in preparation and the balanced ledger.

## On the VPS

Use `scripts/load-business-demo.sh <reviewed-tools-commit>` after the accounting website release is installed. It fetches the reviewed loader files from Git without checking out a new application version or rebuilding the site. It briefly stops only `engineer-cafe` and its notification worker, takes and verifies a cafe database backup plus `.env`/commit metadata under `/var/backups/engineer-cafe/demo-data-*`, imports the sample, and restores the original running services even after failure. Unrelated apps remain untouched.

The importer does not enable automatic integration, change existing recipes, import an old database dump, reseed the original catalogue or change login credentials. Open `/admin/business`, refresh, search `DEMO` in Orders/Customers, and choose the last 30 days in reports to view the whole sample. If integration is still off, new real menu orders keep the existing workflow; the loaded tracked demo tickets still illustrate stock, invoices and payments.

Posted sample journals remain part of the ledger, just like other posted transactions. There is no destructive “wipe demo” command. Corrections require linked reversals/settlement; do not restore the pre-demo dump over newer genuine activity without a separately reviewed recovery plan.

## Local validation

The runner requires an explicitly loaded `DATABASE_URL` and accepts only the known cafe database name or the isolated `cafe_business_test` / `cafe_demo_seed_test` databases. Its default action is a preview. An apply command is:

```bash
CAFE_DEMO_SOURCE="$PWD/scripts/business-demo-data.ts" node scripts/business-demo.cjs --apply
```

The CLI adapter resolves Next's `server-only` marker to Next's own empty server module only in this separate process; it does not patch the running web app. It uses the installed `tsx` and Prisma packages and does not install dependencies or change the schema.

Validation covers a clean isolated database (600 orders / 360 attendance records), an isolated database with existing financial activity and a closed period, and repeat imports. `scripts/tests/business-demo-verify.cjs` checks 28 stock/ledger/date/privacy/settlement invariants against local test databases only. `python -m unittest scripts.tests.test_demo_import_backup` checks verified backup ordering, failures, service recovery and preservation of edited accounting code. The populated business screens were also checked at a 390px mobile width.

## Usable assumed-data practice

The owner's latest instruction is to assume plausible cafe figures like the supplied spreadsheet. Run the same backup wrapper with a second argument `practice` to reuse the existing 600-record sample and make normal workflows usable. The label remains **ASSUMED / TEST**, never genuine cafe history.

Practice mode adds recipes only where a normal-menu product is missing a recipe; existing recipes, prices, images, passwords and legacy orders are retained. Those added recipes point to the clearly labelled sample ingredients. Recognised food add-ons also receive missing assumed recipes. The training-product category remains hidden so it does not duplicate the public menu.

Four limited STAFF test logins are created for manager, cashier, waiter and chef, linked to the sample employees. Passwords are random and saved only in a mode-0600 `practice-logins.txt` under the private backup's `practice` directory (also available through `/var/backups/engineer-cafe/practice-latest`); they are not printed in logs or stored in audit JSON. Existing employee login links are retained. The new cashier receives a separate practice till with Rs. 20,000 transferred from the sample bank, without changing the real cash account.

Accounting activates only if recipe readiness passes and no untracked legacy tickets are open. Otherwise the import retains those tickets and prints their numbers for the owner to finish/cancel in the normal workflow before activating in Opening setup. Closed periods are never reopened.

Eight Excel-compatible CSV snapshots are exported: Daily Sales Report (the reference sheet's quantity/price/sale/cost/profit/profit-percent columns), staff salaries, ingredient stock, payroll, attendance, purchases, expenses and summary. Profit percent based on cost and margin based on sales are distinct columns. Every file identifies its figures as assumed. These private snapshot files do not publish financial records or credentials on the storefront. New live reports continue to come from the website.

The base sample and practice setup have separate completion markers. Repeating either phase adds no duplicate orders, recipes, users or cashier float. If report export fails after a completed database phase, rerun to regenerate the CSVs rather than re-importing the records.

Operational practice validation includes 40 real API checks for a normal-menu order through cashier, chef, waiter, payment, stock and profit, plus guarded activation with an existing legacy ticket. Repeat setup preserves the same test passwords and does not repeat the cashier float.

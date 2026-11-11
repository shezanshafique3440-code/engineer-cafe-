# Complete Excel business report

Owners/admins can open **Business overview** (or any business workspace), choose **From** and **To**, select a **Report**, then click **Download Excel**. The current workspace preselects its related report. Each module downloads its own detailed `.xlsx` file. **Download All (ZIP)** contains nine separate workbooks from one consistent database snapshot:

- Orders.xlsx: orders, items/add-ons, history, posted sales/costs and order payments.
- Inventory.xlsx: ingredient snapshot, movements, counts, reservations and recipes.
- Purchases.xlsx: suppliers, purchase invoices/items/orders, supplier payments and balances.
- Employees.xlsx: employees, attendance, payroll, staff payments and balances.
- Cash-Shifts.xlsx: opening/closing/review details and recorded variances.
- Riders.xlsx: riders, deliveries, commissions, settlements and rider balances.
- Financial-Report.xlsx: posted income/expenses/profit, payments, journals, ledger, and account/party balances.
- Customers.xlsx: customer directory, loyalty, credit parties and balances.
- Menu-Tables-Approvals.xlsx: menu/add-ons/coupons, tables/sessions, approvals and audit history.

Downloaded filenames include the selected dates. Each workbook has its own Summary and Read me, freeze panes, column filters and headers even for empty sheets. A module export only queries its own detail sheets; the ZIP reads all source data once. Payment rows and party balances are restricted to the relevant module. The prior combined-workbook API remains compatible, while the owner interface now offers separate Excel files and ZIP.

Included: orders and historical items/add-ons, status history, posted sales/costs, purchases and lines, purchase orders, inventory movements/counts/reservations, employees/attendance/payroll, overlapping cash shifts and table sessions, riders/deliveries/commissions/settlements, payments, journals/postings/expenses, approvals/audit history, recipes/menu/add-ons/coupons, customers and loyalty entries.

## Reading the figures

- Timestamps use Asia/Karachi, including all of the To date. Accounting entries use their recorded business date. Orders/items are grouped by order creation date; order history, payments and accounting records use their own dates.
- Income, expenses and net profit come from posted ledger entries, including reversals. The separately labelled order value includes every order status and must not be mistaken for recognized revenue. Accounting may be disabled or incomplete for legacy/untracked orders.
- Account/party opening and closing balances include earlier postings. Positive balance means debit; negative means credit. Separate receivable/payable/advance/control accounts should not be added together indiscriminately.
- Current ingredients, people, recipes, product prices and contact details reflect the consistent database snapshot at download time, even when selecting historical dates. They are labelled **Current**. Historical inventory movements remain in the selected period.
- Cash shifts, table sessions and payroll periods are included if they overlap the range. Their full recorded amounts are not prorated.
- Orders, delivery rows, expense rows and ledger entries are overlapping views, not amounts to sum across sheets.
- Sync each counter's pending offline bills before downloading a final report; unsynchronized browser bills cannot be included in a server export.

## Access and limits

Only active ADMIN accounts may download a complete report. Staff, including managers with individual reporting permissions, cannot use the download button or endpoint. Fixed field allowlists omit password hashes, authentication tokens, integration secrets and private demo backup paths. Text is stored as text, never executed as Excel formulas. Long text is continued in a separate sheet.

The export uses a read-only repeatable-read transaction; it does not initialize accounting, seed data, modify stock or create journals. File generation permits one report at a time per app process. Choose up to 732 days. Above 50,000 rows in any one sheet or 150,000 detailed rows total, the request fails clearly and asks for a shorter range; it never silently downloads partial results.

## Validation

- Production build and TypeScript validation.
- `scripts/tests/complete-report-integration.cjs`: real HTTP/XLSX tests for access restrictions, missing/invalid dates, Pakistan midnight boundaries, more than 200 rows, linked item counts, formula-like customer names, historical balances, posted profit, empty periods and no accounting writes.
- `scripts/tests/complete-report-browser.cjs`: actual mobile owner download/readback, filename/date selection, invalid range, retry message, overflow/runtime errors and manager visibility.
- Tests require an explicitly disposable localhost `cafe_demo_cleanup_test` or `cafe_operations_test` database, `AUTH_SECRET`, and local production server (`CAFE_REPORT_TEST_URL`). Fixtures are never created in the live database.

## Release

This release adds pinned `exceljs@4.4.0`, with its locked dependencies. The deployment installer recognizes the previous offline/routing releases, verifies the private database backup, installs changed locked dependencies and builds before restarting cafe services. It does not run a seed or reset. Original business permissions and database schema are unchanged.

Separate-files validation also opens every workbook inside the downloaded ZIP, checks ZIP CRCs, confirms every original detail sheet is covered, checks invalid module/format combinations and verifies a Riders download excludes unrelated order/payroll sheets. Browser tests download both an individual file and the nine-file ZIP on mobile. No extra runtime dependency or database migration is required for the separate-files update.

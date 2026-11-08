# Daily cafe workflows

The admin interface uses English throughout. The sidebar openly lists **Daily operations & business** and **Website & administration**. Use **Website & admin tools** to jump to Dashboard, Products, Categories, Customers, Coupons, Reviews, Messages, Analytics, Settings and the other original tools. These links remain subject to the existing staff permissions. The original dashboard is available at `/admin/dashboard` for users with insights access; `/admin` is the daily task home.

## Daily routine

1. Sign in with your own account. Cashiers start with **New sale**, waiters with **Tables & orders**, chefs with **Kitchen orders**, and owners/managers with **Business overview**.
2. Open your cash shift before taking cash. Home shows pending orders, open tables, your own drawer status and deliveries awaiting rider assignment. These are current work counts, not today's revenue.
3. **New sale:** choose items, check quantity, select the receiving account and enter actual cash tendered. Exact/rounded-cash shortcuts fill the amount; they do not submit payment. Use **Record payment & send ticket**, then print the confirmed receipt. Customer details, approved discounts and credit remain separate optional tools.
4. **Tables & orders:** open an available table, then use **Add items / send ticket**. The order desk opens inside the tables screen and updates the running bill. Receive payment and close the settled table. The existing waiter assignment scope is preserved.
5. **Kitchen orders:** check a new ticket, mark Preparing, then Ready when prepared. Payment and final handover remain separate.
6. **Riders & deliveries:** assign the order, update its next status, collect rider cash and record commission payments. Completion asks for handover/payment confirmation. Rider cards show cash held, commission due or amounts to recover. Commission remains 15% of the net food amount, excluding tax and delivery fees.
7. **Stock levels:** review available quantities and low-stock alerts. Add ingredients or choose **Waste / stock adjustment** when needed. Record supplier deliveries through **Receive purchases**, never as a duplicate opening adjustment. Detailed stock and movement records remain available.
8. **Receive purchases:** select the supplier, enter invoice quantities/costs and receive stock. Record only actual payments; credit invoices can be paid later. A purchase order alone does not receive stock.
9. **Attendance:** choose Present, Absent, Paid leave or Unpaid leave for an unrecorded current-day employee. Quick attendance does not invent clock times or overtime and cannot overwrite an existing record. Use the full form for times, half days, overtime and corrections. Current-day cards remain accurate when viewing an older report range.
10. **Pay salaries:** prepare a draft, review attendance/advances/deductions, post payroll, then record actual payment. Cards show net salary, paid amount and remaining payable; breakdowns are expandable.
11. **Cash opening / closing:** review offline bills, table balances and rider cash. Acknowledge checks on other devices, then count cash. Pending/conflicted bills on this browser/login prevent proceeding to the count form. This check cannot inspect another device's local bills. Enter the actual cash count and explain any difference; existing server financial safeguards remain authoritative.
12. **Offline counter:** prepare the cashier's device online with an open shift. Connection status is visible. Save provisional cash bills before printing; reconnect sync retains the same UUID. Review rejected bills explicitly. Never clear browser data while bills remain pending.

Reports initially show **Today** in the Pakistan business calendar. Choose **This month** or explicit From/To dates for another period. Mobile quick navigation follows the role; the bill shortcut stays above the bottom menu.

## Preservation and release

The original storefront, database, uploads, receipt IDs, stock reservations, journals, permissions and commission rules are preserved. This interface release introduces no dependencies, migrations, seeds, opening balances or database switches. Use the existing backup-first deployment wrapper with the reviewed pinned commit. Actual printers/drivers and client acceptance still need testing on their own devices.

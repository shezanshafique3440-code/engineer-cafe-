# Simple cafe workflows — client preview

This release changes the staff workspace, not the public storefront or existing business records. It keeps all permissions, receipt IDs, stock reservations, financial posting, commission rules and the original migrations. There are no new dependencies, migrations, seeds, imported opening balances or database switches.

## Client ka roz ka routine

1. Apna login use karein. **Home / Roz ka kaam** par sirf allowed kaam milenge. Cashier ka pehla task **Naya bill**, waiter ka **Tables**, chef ka **Kitchen**, owner/manager ka **Aaj ka hisaab** hai.
2. Cashier pehle **Cash opening / closing** mein apni shift khole. Home par own drawer ka live status, open orders/tables aur unassigned deliveries dikhti hain. Counts are current pending work, not today's revenue.
3. **Naya bill**: category ya search se items chunein, quantity check karein, received account choose karein, actual cash enter karein. Exact/rounded-cash buttons speed up entry but never submit payment. Then **Record payment & send ticket**; receipt confirmation follows. Customer name, approved discounts and credit are separate optional tools. A credit sale stays visibly labelled even if its disclosure is closed.
4. **Tables**: free table card se table kholein. **Add items / send ticket** opens the order desk inside the same tables screen. After sending, the running bill updates. Return to the table, receive payment, and close the settled table. Pending cash is shown explicitly. Other waiters' private table sessions remain hidden by the existing server scope.
5. **Kitchen**: ticket dekhein → Preparing → Ready. Payment and handover remain separate; existing role restrictions are retained.
6. **Riders**: each rider card shows cash held and commission to pay/recover. Action buttons open one relevant form at a time. Active delivery cards offer only the next status, require assignment before dispatch and ask for handover/cash confirmation on completion. Detailed performance and order history remain available under expandable reports. The 15% net-food rule is unchanged.
7. **Stock**: available quantities appear as cards; full movement/cost records remain accessible. Add ingredient and wastage/correction forms open only when chosen. Use **Maal khareeda** for supplier deliveries. Unit conversion guidance stays visible; received stock must not also be entered as an adjustment.
8. **Purchases**: supplier invoice → received quantities/costs → actual payment. Links lead directly to supplier setup/payment and ingredients. Purchase orders remain an extra tool, not a stock receipt.
9. **Hazri**: choose Hazir, Ghair hazir, Paid chhutti or Unpaid chhutti for an unrecorded current-day employee. Existing attendance is never overwritten by a quick action. Current-day cards remain correct when viewing an older report range. Clock times, half days, overtime and corrections use the full form; a quick action never invents clock times or overtime.
10. **Salary**: draft → review/post → actual payment. Salary cards show net salary, paid amount and remaining payable; breakdown is expandable. Existing payroll review, calendar and posting safeguards remain intact.
11. **Closing**: review unsynced local bills, table payments and rider cash; acknowledge checks on other devices, then count cash. Pending/conflicted bills on this browser/login prevent proceeding to the count form. This is a device check, not a claim to inspect every cashier device. The server remains responsible for authoritative shift/financial checks. The count form supports total cash or denominations and an explained difference.
12. **Offline counter**: online/offline state is visible, with three simple billing steps. Prepared snapshots, durable outbox, automatic reconnect sync and same-UUID conflict correction are retained. Never clear browser data while bills are pending. Actual printer/driver/feed require a device test.

## Navigation and dates

The primary menu contains everyday tasks. Website management, marketing and detailed tools are behind **Extra tools / Website settings**. Mobile quick navigation follows the role and keeps billing shortcuts above its bottom menu. The public site's theme/layout is preserved.

Business workspaces include a short three-step guide and optional help. Reports initially show **Aaj** (Pakistan business date); choose **Is mahine** or explicit From/To dates for another period. Financial ledger and change history remain available as detailed tools. Hiding an interface control never replaces server permission checks.

## Review and deployment

Review the local browser screenshots and role flows first. This release is a client preview; it is not automatically deployed to the VPS. Deploy only after the owner reviews it, using the existing backup-first wrapper with a pinned commit. There is no database migration or seed for this interface update. Existing public website, current database and uploaded files remain in place.

## Validation

The disposable local cafe database passed 447 HTTP/accounting assertions, 24 offline browser assertions, 123 easy-workflow browser assertions, 68 library tests and 38 deployment/backup/import recovery tests. Easy-workflow checks cover 320/390/768/1440-pixel layouts, per-login masked home data, exact-cash billing, same-screen table tickets/payments, quick attendance, mobile navigation overlap and blocked closing with pending local bills. Production build and a production-server browser pass complete the preview verification. Physical printers and actual client acceptance still require their real devices.

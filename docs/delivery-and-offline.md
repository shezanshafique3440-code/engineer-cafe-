# Riders and offline POS

This release extends VPS commit `80b8808ba32ff41342d43d1cb82a650efa292e3c`. It retains the existing storefront, notifications, ledger, stock/recipes, payroll, approvals, table service and eight original migrations. There is no catalogue seed, accounting activation, client-database switch or historical commission backfill.

## Riders & deliveries

Open **Cafe business system → Riders & deliveries** (`/admin/business?section=delivery`). Manager and cashier profiles have this module; the owner can restrict individual access in Opening setup & access. Commission payouts/recoveries require owner financial access. Rider cash remittances require payment access.

1. Add a rider's real name, phone and unique code. Profiles are retained rather than deleted. A rider with active deliveries cannot be deactivated.
2. Assign a tracked delivery before dispatch. Only active riders and unsent orders are eligible; stale edits are rejected. Preparing/ready/dispatch/delivery controls use the existing order/payment permissions and kitchen/accounting logic. Legacy untracked orders stay in their existing records.
3. Completion accrues **15% of food subtotal after all discounts**, excluding tax and delivery fees, rounded to the nearest paisa. It debits delivery expense and credits rider commissions payable, once, inside the same transaction as invoicing. A cancelled order reverses that accrual once.
4. Record actual commission payments from an available cash/bank/wallet account. Outstanding commission cannot be overpaid. A rider may retain commission from their own recorded delivery cash; the system checks both their cash held and the control account balance.
5. Use **Receive rider cash** when money is actually handed into a drawer/bank/wallet. This transfers existing rider cash rather than recording a second sale. Bank/counter-prepaid deliveries do not invent cash held by the rider.
6. Actual payouts remain immutable after cancellation. A negative commission due is an overpayment recoverable from that rider or offset by later earnings. Use **Receive overpayment recovery** to record an actual recovery, up to that balance.

Reports show per-rider and total earnings, reversals, payouts, recoveries, outstanding commission, cash held, delivered/active counts and average elapsed delivery minutes. Earnings, payments and performance follow the selected Karachi business-date range. Outstanding balances are current. CSV exports are available. Unattributed historical/manual rider-cash balances are shown separately for owner reconciliation; they are never silently assigned to a new rider.

Commission journals, payouts and cash transfers use the existing balanced ledger and audit history. Profit recognises the expense when earned, not a second time when paid. Commission amounts and transfer history cannot be edited/deleted; corrections use reversals and recovery records. Idempotent request IDs prevent double posting.

## Prepare each cashier device

1. Activate accounting through the existing readiness checks and open the cashier's own cash shift.
2. Open **Counter POS** (`/admin/pos`). Normal cash entry now opens the same **Cash counter** (`/offline-pos.html`) both online and offline. Prepare it once online with your own open shift; wait for offline files and products to finish loading. It saves public menu/add-ons/prices/settings, prepared table references and the original cashier/shift/account in IndexedDB.
3. Keep using this counter when internet fails. Every bill is saved locally before sync is attempted, even while online. A prepared app reopened offline returns to this cash counter. Credit, approval discounts and bank/wallet workflows remain at **Advanced online POS** (`/admin/pos?online=1`); that desk requires internet.

No session token/password, authenticated HTML or private API response is stored in the service-worker cache. The prepared snapshot contains no order history or other customers. Bills are scoped to the original cashier. Changing the signed-in cashier prepares their own counter without deleting the first cashier's bills. Logout clears preparation and notifies other open counter tabs; queued bills remain recoverable by the original cashier.

## Offline cash billing

The offline counter supports:

- **Takeaway** cash bills.
- **Dine-in** cash-paid tickets for tables that were already open when prepared. This is payment for that ticket, not a claim that every other ticket at the table is settled. Opening tables and credit/combined-bill administration require the online system.
- **Delivery paid at the counter**, including phone/address/city and the cached delivery-fee/free-delivery rule. Assignment and dispatch happen online after sync. Since cash was received at the counter, it is not also recorded as money with the rider.

Choose products, required add-ons, quantities and notes; enter actual cash tendered. Current product offers are included. Credit sales, bank/wallet provider confirmations, coupon validation and approval discounts remain online workflows. The counter checks cash covers the complete bill, including tax/delivery, and prints change to paise.

Save before printing. Bills are durably stored with a UUID and clearly printed **PROVISIONAL — NOT SYNCHRONIZED** until the server confirms the official order number and payment. Receipt formatting is for 80mm paper; actual printer/driver/feed still need a real-device check.

## Synchronization and conflicts

Pending bills sync on reconnect, when the prepared cashier reopens POS, and through a 15-second pending-bill retry while the page is visible. This also recovers when Wi-Fi stays connected and no browser online event fires. Supporting browsers can also use Background Sync while the page is closed. A valid session with current POS permission is required. Sync first checks the server's offline protocol; a browser kept open across a code rollback cannot send bills to an older, unguarded POS endpoint.

The server rechecks each line price and total, add-on rules, availability, product/ingredient stock, cashier permissions, the original still-open cash shift/account, and the prepared table if applicable. A committed request whose response was lost returns the original order even if prices or shifts later change. It never creates another receipt, reservation or payment.

- **Pending** means confirmation is unknown; retry retains the original UUID and contents. It cannot be edited or locally voided while it might already exist on the server.
- **Conflict** means the server rejected the transaction. Nothing was partially posted. Open **Review & correct** online, load current prices/shift/table, reconcile any cash difference, then save the same UUID explicitly. Historical payload/error details are retained locally.
- **Synced** has the official order number and server payment state.
- **Void** is allowed only for a rejected bill with a reason. The local history remains; it never cancels a server order or manufactures a refund.

Keep the browser profile/local data and printed bills until all transactions are reconciled. Export local bills for a private backup when needed. Unconfirmed cash must be reconciled separately from a closed drawer: if it was included in a closing variance, have the owner resolve that difference before explicitly moving the rejected bill to another shift. The app never silently assigns it to a new cashier or drawer.

## Release and verification

The additive migration `20261108190000_delivery_commissions` creates rider/commission/transfer records and nullable rider links on orders. Existing rows and all old migration bytes remain intact. Existing profile-based grants are retained; the new module is part of manager/cashier profiles and can be masked per login.

Local isolated validation passed 447 HTTP/accounting assertions (330 existing and 117 rider/offline), 24 real Chromium browser assertions, 65 library tests and 38 deployment/backup/import recovery tests, plus the production build. Browser coverage includes offline form/printing/reload/reconnect/conflicts, a dropped-response replay and per-user controls. Test fixtures use only the local `cafe_operations_test` database; no live rider identity, stock, sale or cash entry is fabricated.

Run `scripts/tests/delivery-offline-integration.cjs` after the existing business/operations fixtures and suites; `scripts/tests/delivery-offline-browser.cjs` follows it, using the existing documented external pg/Playwright test tooling settings. The new service-worker/public scripts also receive syntax checks. Production dependency versions are unchanged.

Deploy the pinned reviewed commit with its `scripts/deploy-reference-storefront.sh` backup-first wrapper. A build/deploy failure before delivery activity can restore the prior code/build, retaining all data and additive tables. Once commissions or active assigned deliveries exist, rollback to a pre-delivery release is blocked before stopping services: that code cannot maintain these new financial side effects. Use a compatible forward fix instead; database dumps are never automatically imported over current business data.

## Offline startup repair

A slow first service-worker installation could previously show “ready” before any offline fallback existed. Turning off the network then produced a failed/blank navigation. The standalone document also depended on preparation from another page, and missing shift/login instructions were easy to miss.

The shared public bootstrap now waits for offline-cache activation before readiness and initializes a direct visit to `/offline-pos.html`. Failed installation stays visibly unready. The standalone page shows login/own-shift steps instead of an unexplained empty bill area. Version 5 replaces public shell caches only; the IndexedDB database name/version, cashier ownership, saved payloads and request UUIDs remain unchanged. No browser-data clearing is needed.

Repair validation: 447 existing HTTP/accounting assertions, 24 existing offline/rider browser assertions and 21 new Chromium cold-start/cache-upgrade assertions passed. The new tests delay asset download, fail cache installation, prepare a first-time direct visit, check no-shift/login states, reload offline and carry a pending version-4 bill through the version-5 upgrade. Production build, TypeScript and JavaScript/shell syntax checks passed. Live application still requires the pinned VPS deployment and verification on the client's actual browser/printer; no live customer bill was fabricated by these tests.

Run the cold-start suite with `node --env-file=.env scripts/tests/offline-startup-browser.cjs`. Set `CAFE_STARTUP_TEST_URL` to the local production test server and `CAFE_STARTUP_TEST_OWNER_ID` to its existing ADMIN fixture ID (default: `demo-qa-owner` from the isolated demo suite). It requires an explicit local disposable test database and test `AUTH_SECRET`; the requests are proxied through local fixtures and never submitted to the live site.

## Offline-first cash workflow

The prior readiness repair did not make the advanced online form offline-capable. The default POS entry point now opens the durable cash counter so a cashier does not need to switch screens when connectivity fails. Existing advanced/credit/wallet/approval tools remain available through the online link. No original financial record, role, recipe or database schema is changed by this workflow update.

Warm cash-counter navigation uses the cached public document immediately. A bounded network fallback opens the prepared cash counter from an installed app's offline home. Current cached files are used before background update checks. Stalled navigation/session/sync requests have timeouts, and a server outage/503 is not treated as logout. Actual 401/403, signed-out responses and original-cashier mismatches still block server synchronization. All server permissions, shift checks, price/stock checks and idempotent UUIDs remain authoritative.

Additional real-Chromium coverage closes/reopens a persistent browser profile completely offline, saves orders with internet disabled and with a stalled WAN while navigator.onLine remains true, confirms both original UUIDs sync by the retry timer without a focus/online event, and verifies cached identity survives network errors but clears on an authoritative sign-out. Do not use private/incognito browsing or clear site data while bills are pending. The website's other administration screens still require internet.

Offline-first workflow validation passed 447 real HTTP/accounting assertions, 24 existing browser assertions and 39 extended cold-device/recovery assertions, plus production build/type checks. The extended suite blocks the origin itself as well as using Chromium offline emulation, closes/reopens a persistent profile, retains an in-progress draft across a delayed menu refresh, and recovers an online bill whose response was lost before the browser closed. Physical counter/printer verification remains a client-device check after deployment.

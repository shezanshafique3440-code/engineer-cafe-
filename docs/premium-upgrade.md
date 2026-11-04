# Premium cafe upgrade — local review

Status: implemented and locally validated. GitHub publication is approved; live VPS rollout is a separate step.

## Features to review

| Feature | Route | Actual behavior |
| --- | --- | --- |
| Kitchen live | `/admin/kitchen` | 15-second refresh while visible, pause/resume, fullscreen, oldest-first lanes, elapsed/over-estimate timers, service and ticket filters, item options/notes, one-step staff progression and explicit handover confirmation. |
| Business intelligence | `/admin/insights` | Delivered and paid order values, outstanding order value, cancellation rate, repeat-customer share, average delivered value and a weekday/hour demand heatmap in Asia/Karachi. |
| Customer segments | Insights → Customer segments | Phone/account grouping, New/Returning/VIP/At risk rules, name/phone/segment filtering and safe CSV export. Segment criteria and selected-window limits are explained in the UI. |
| Menu signals | Insights → Menu signals | Delivered quantity/revenue, low-stock and paused items, popular items, highly rated low-volume “hidden gems”, and products not ordered in the selected range. No invented profit or predictions. |
| QR menu studio | `/admin/qr-studio` | Branded poster preview, category/full-menu/meal-finder destinations, editable headline, standard UTM campaign tags, PNG download, copied link and printable poster. QR generation is local; tags do not count scans. |
| Smart meal finder | `/meal-finder` | Group size, total budget, vegetarian/mild filters and optional drinks. Includes required options, discounts, current stock, group quantities and cafe minimum. Adds a chosen meal to the real cart after a click. |
| Shareable carts | Cart → Share cart → `/shared-cart#items=…` | Portable item/quantity/option links. Current product details and prices are fetched again. Invalid/unavailable options are flagged. Nothing imports before an explicit click. Personal notes, addresses, coupons and payment data are omitted. |

## Operational safeguards

- Public pickup checkout remains PENDING/UNPAID. Cash is recorded as paid only after staff confirms delivery/handover.
- Online orders cannot be completed without a paid status. This does not add a payment provider, transaction capture or payment webhook.
- Cancelled orders cannot be reopened; delivered orders cannot return to kitchen lanes. Existing order history remains readable.
- Version-checked order transitions reject stale screens before stock/coupon side effects.
- PostgreSQL transaction locks protect order-number allocation. Pricing/coupon checks are repeated on the same transaction connection after allocation.
- Atomic stock reservations prevent last-unit overselling, including multiple option variants. Failed orders roll back all records, inventory and counters.
- Cancellation stock/coupon arithmetic avoids lost updates and negative counters.
- Cart product links now retain category slugs; old stored carts fall back to menu search.

## Validation performed

- TypeScript check and ESLint.
- 15 premium utility tests plus the existing 2 mobile utility tests and 4 middleware redirect tests.
- Actual PostgreSQL transactions in a dedicated `cafe_premium_test` database, using the official Prisma PostgreSQL adapter/WASM client. Cases include concurrent duplicate cancellation, stale kitchen versions, unauthorized access, public pickup payment state, last-unit checkout races, one-use coupon races, unlimited stock and rollback of oversized variant orders.
- A production Next.js compilation/prerender against that isolated database. Test-only local font responses and a test-only official Prisma WASM adapter/preload were necessary because this cloud instance blocks native-engine/font download domains. No verification was disabled. Those helpers and generated runtime files are local test artifacts, not tracked application source or deployment files.
- Full-stack Chromium tests on the built app with actual login/session cookies, API requests and PostgreSQL data: meal → cart → share → separate guest import, kitchen progression/handover, customer insights/CSV and QR PNG download.
- 28 viewport checks over the new screens at 320, 375, 390, 768, 1024 and 1440px, including guest shared-cart widths. No horizontal overflow or browser runtime errors observed.
- Independent QR decoding of the downloaded PNG confirmed the menu URL and campaign tag.

## Practical boundaries

- No new production dependencies, external API credentials, subscription service or database migration.
- Insights examine at most the latest 5,000 orders and 2,000 products; the UI reports partial datasets. Customer rules use delivered orders within the selected window, not all-time customer lifetime value.
- Kitchen shows the oldest 150 active tickets and reports the total when more exist.
- Meal suggestions cover up to 200 live products and the cafe's current parathas/anday/chai categories. Required options use valid defaults or an available required choice; optional paid extras can be selected on the product page.
- Shared links support 20 configured lines, at most 50 units per line, and a bounded URL payload. Prices and availability can change; server cart/checkout pricing remains authoritative.
- Fullscreen, printing, clipboard and native share availability depend on the browser. The UI handles denied/unsupported actions with messages.
- Final native-engine VPS build, real mobile Safari testing and live deployment checks remain for the approved deployment step. Printed QR codes should use the intended long-term domain.

## Before publishing

Review the local source and this behavior summary first. Only push when the user explicitly requests it. Preserve the production `.env`, menu-image uploads and database. The existing guarded updater now includes the premium utility test file; run the full VPS build and verify the new protected/public routes after an approved rollout. Do not seed or migrate production as part of this upgrade.

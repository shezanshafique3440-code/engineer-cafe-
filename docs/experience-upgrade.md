# Cafe experience upgrade

This release adds the seven selected improvements, keeping the existing dish animation and admin theme system.

- Two-step mobile checkout: contact/service/time, then payment and review. Saved addresses, inline errors, a fixed mobile total, live price checks and retry protection are included.
- Customer rewards at `/account/rewards`. New signed-in orders earn points on handover, based on item spend after discounts, excluding tax and delivery. One reward can be redeemed per order. Cancellation returns spent points and reverses earned points atomically. Existing orders do not receive retroactive points. If earlier earnings were spent before an order was cancelled, a negative balance is covered by future earnings.
- Staff counter POS at `/admin/pos`: searchable live menu, required options, a separate counter cart, cash received/change, paid kitchen tickets and 80mm receipt printing. Walk-in sales remain guest sales and do not receive account rewards. The online ordering pause does not close the staff counter.
- Order-ahead checkout with Pakistan time, configurable daily service hours (including past midnight), minimum notice and maximum days ahead. Scheduled time is shown in orders, kitchen, tracking and receipts. Preparation is blocked until the ticket is within its estimated fulfillment time.
- English/Urdu interface with RTL layout, saved language preference, local menu names and translations for the default menu. Custom text entered by the cafe falls back to its original language when a translation is unavailable. Urdu product names entered by the admin take precedence over the default translations.
- Installable app with 192/512 PNG icons and a bilingual offline screen. The service worker does not store private screens, APIs or orders; placing an order requires a network connection.
- Staff background order notifications using Web Push and a durable database queue. Enable them in `/admin/experience` or through the notification bell's Background alerts link. HTTPS and browser permission are required. On iPhone/iPad, install the app to the Home Screen first. OS and browser power/background policies affect delivery.

Admins configure reward rules and scheduling at `/admin/experience`. Staff can use the POS and enable their own notifications but cannot change program rules. Defaults are one point per Rs.100, and 100 points for Rs.100 off, with 30 minutes' scheduling notice, seven days ahead and daily 08:00–02:00 service.

## VPS rollout and recovery

Use `scripts/deploy-reference-storefront.sh <reviewed-full-commit>` after fetching the release. It checks the exact baseline and upgrade content in `experience-release-policy.json`, stops only cafe processes, and retains checksummed copies of the code, compiled build, dependencies, environment, uploaded files and cafe database before changing anything. It then installs the locked dependencies, applies the additive migration, generates private VAPID keys on the VPS if needed, builds and checks the app, and starts `engineer-cafe-notifications` in PM2. Keys are never committed or printed.

Rollback uses the retained snapshot's `rollback.sh`. It restores the previous code, dependencies and compiled build, and stops the new notification worker. Additive database columns/tables and later orders are retained; it does **not** import an old database dump. Loyalty and scheduling operations pause when running older code, so return to the upgraded release before using those features again. Keep the snapshot's manual rollback command from the deployment output.

No schema reset, production seed, automatic customer messages or changes to unrelated VPS apps are part of this release.

## Verification

TypeScript, ESLint, all nine unit-test files, and release/rollback tests are checked. An isolated PostgreSQL database exercises POS authorization/cash, stock reservation, checkout retry protection, rewards/cancellation, scheduling and durable notification jobs. Browser checks cover English/Urdu checkout, rewards, install assets, offline fallback, and checkout/POS at 320, 390, 768 and 1440px. Push queue delivery/retry/expired subscriptions are verified with real isolated database records and a stub transport; actual delivery through a phone's push provider still needs the live HTTPS installation and permission.

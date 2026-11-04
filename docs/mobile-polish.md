# Mobile and admin usability update

This update adds phone layouts and usability features while keeping the current menu, uploaded images, prices, orders, authentication API and database schema.

## Changes

- Admin tables render as labelled record cards below 768px, with wrapping actions and large controls. Desktop retains scrollable tables.
- Admin bottom navigation links to dashboard, orders and products, with a searchable drawer for the other pages.
- Drawers and admin edit dialogs trap keyboard focus, close on Escape and return focus to their trigger. The drawer closes when switching to a desktop viewport.
- Admin dialogs become scrollable bottom sheets on phones with a visible close control and safe-area padding.
- Login and registration gain password visibility, a Caps Lock hint, inline server/network errors and accessible input labels. Mobile email keyboards and 16px fields avoid iOS focus zoom.
- Login return URLs accept local paths only and reject external destinations and login loops.
- Staff login is reachable from the footer and mobile navigation. The admin login page links back to the cafe and customer login.
- Orders can export the current filtered page to CSV, with formula-injection protection and properly quoted bilingual/customer content. This exports the current page, not all database orders.
- The admin shows an offline warning. It does not queue offline edits or claim they were saved.
- The storefront header uses a compact badge on very small screens and a drawer through tablet widths. Touch controls are larger.
- Storefront search traps focus, reports failed requests and clears stale loading state when a query is shortened. Suggestions match the current menu.
- A back-to-top button respects reduced motion; safe-area spacing keeps navigation, footer and toasts usable on phones.

## Validation

- `npm run lint` passes.
- `npm run typecheck` passes using schema-derived Prisma declarations generated locally through Prisma WASM tooling. The query engine is unavailable in this cloud instance.
- `node --import tsx src/lib/__tests__/mobile-utils.test.ts` executes two passing tests covering redirect handling and CSV quoting/formula protection.
- A separate Chromium fixture renders the actual login, admin shell, orders, product editor, menu browser and navigation components with controlled API responses. It checks widths 320, 360, 375, 390, 430, 768, 1024 and 1440px. This exercises UI behavior, not real server authentication or order mutations.
- Full Next.js production build and real database/authentication validation remain required on the VPS because this instance's network policy blocks the verified Prisma engine download. Checks are not disabled to work around it.

## VPS deployment

Fetch the code branch, extract `scripts/deploy-mobile-polish.sh` outside the checkout using `git show`, then run it with the exact fetched commit SHA. It refuses local tracked edits or dependency/schema differences, records the old commit and build, preserves `.env` and uploaded image files, builds and tests on the VPS, restarts only `engineer-cafe`, and checks the HTTPS login page. The updater compares public product prices and image paths before/after. It never seeds or migrates the database.

Engineer Cafe has a short maintenance window while building. Other PM2 applications and Nginx configuration are unchanged. If a command fails, the updater attempts to restore the previous code and production build. Retain the printed backup path. The deployment pins a detached Git commit so the exact version is recorded.

After deployment, test a real staff login from a phone at `https://esellerstore.vip/admin/login`, open orders/products, edit a test product, check mobile menu/cart, and confirm no unexpected order is created. Do not share passwords or cookies in screenshots or console output.

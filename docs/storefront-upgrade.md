# Storefront upgrade

Storefront features prepared for release. VPS deployment is a separate step from publishing the Git branch.

## Customer features

- Photo-led signature collections using existing menu photos and current prices.
- `/discover`: mood-based discovery for signature, comforting, bold, mild vegetarian and value choices. These are deterministic menu filters, not an AI service. Unavailable and zero-stock dishes are excluded.
- `/compare`: shortlist up to three dishes and compare price, preparation time, spice, dietary details, available calories and customer ratings. Adding a customizable dish opens its real option picker.
- Recently viewed dishes on the home and menu pages, with a clear control. History stores at most eight slugs and timestamps for 14 days in the current browser. Comparison stores only slugs; current product details are fetched again.
- Complementary suggestions on product and cart pages, excluding dishes already selected and unavailable dishes.
- Delivery/pickup preference remembered in the browser and connected to cart quotes.
- Cart progress for the cafe minimum and free delivery. Minimum uses subtotal before discount; free delivery uses subtotal after discount, matching existing checkout rules. Milestones wait for quote refresh.
- Service status and minimum-order ribbon driven by cafe settings.

## Polish and corrections

Corrected the hero's broken combos destination, use actual approved review aggregates on the homepage, disable adding zero-stock dishes, and restore bundled display fonts previously overridden by CSS variables. Product customizers render through a body portal and retain keyboard focus inside the dialog.

## Validation

TypeScript, ESLint, six business-rule tests and a production build passed. Browser checks cover the home, discovery and comparison pages at 320, 375, 390, 768, 1024, 1280 and 1440 pixels. Interactive checks cover comparison persistence and limits, browsing memory, service preference, configured pairing additions, live cart quotes and selection endpoint validation.

Local integration checks use an isolated PostgreSQL database and an external QA-only preload with Prisma's official JS/WASM client and PostgreSQL adapter because native engine downloads are restricted in the managed environment. This override is outside the repository and must not be deployed. Production dependency manifests, Prisma schema and migrations are unchanged. VPS verification remains necessary after the user authorizes deployment.

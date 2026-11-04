# Cafe motion and shared identity

The previous homepage chose one chai item and overrode its own colour palette. It now selects up to five real, varied menu items and uses the same root colour/type tokens as the menu, login and admin.

## Hero behavior

- Five stable product buttons move between left, right and centre positions every 5.2 seconds. Featured products rank first, with category variety filling the remaining slots; a single featured Kashmiri chai no longer pins the whole hero to one item. Current names, descriptions, base prices and product links change with selection.
- The cup, liquid streams, impact splash, droplets, steam and ice are independent layers. A 10.4-second sequence lowers and tilts the cup, pours liquid, spills tea and expands the splash. The cafe background transitions into the gold stage. These are composited photographic sprites and SVG/CSS animation, not a WebGL fluid simulator.
- A sticky scroll sequence lowers/scales the cup further as visitors scroll. Small-screen layout reserves room above the fixed bottom navigation. Product selection, previous/next, pause and replay controls remain usable.
- Animations pause when the tab is hidden, the hero is offscreen, or a keyboard user focuses its controls. Pointer clicks do not accidentally leave autoplay permanently paused. Reduced-motion users get a static cup and manual product choices without the liquid sequence or pinned scrolling.
- Unavailable, zero-stock and packaging items are excluded. Small/empty menus do not invent duplicates. Product choices remain links to the actual option picker/menu; decorative chai artwork does not bypass ordering validation.

## One theme

The homepage no longer defines its own `--c-*` palette. Root Chai tokens supply cream/caramel colours throughout the storefront and admin, including header/sidebar treatments and a shared serif heading font. Other admin-selected palettes propagate to the homepage as well. First paint follows the cafe's house theme by default; an explicit personal dark/system preference applies consistently across routes.

For this rollout, `CAFE_SHARED_THEME=chai` selects the shared Chai house palette after the pre-release backup. This is a single `CafeSetting.theme` update, not a schema migration. Theme preview/save continues through admin settings.

## Backup and rollback

The guarded deploy wrapper retains Git source, production build, `.env`, uploaded files and the cafe database. `CAFE_SHARED_THEME=chai` additionally saves the old theme value in the checksummed snapshot before changing it. Failure recovery and manual rollback restore the old code/build and that one theme field when present. Current orders, menu data, uploads and `.env` are preserved; the database dump is never automatically imported. Older snapshots without a saved theme retain their existing behavior.

Snapshots remain under `/var/backups/engineer-cafe/release-*`; `/var/backups/engineer-cafe/latest/rollback.sh` restores the most recent saved release. Keep the exact printed path to restore a particular snapshot after future releases.

No new production dependency or Prisma schema/migration is required. Native VPS build and HTTPS/asset checks run during deployment. Isolated local integration checks use the external QA-only official Prisma PostgreSQL/WASM adapter described in `storefront-upgrade.md`; it is not deployed.

## Validation

- Five selector/slot/default-appearance tests, including the reported one-featured-Kashmiri case.
- Ten disposable-repository release tests with real Git/archive/checksum operations and mocked PM2/Docker/HTTP. Cases include build/asset/backup failures, immutable snapshot verification, later rollback, palette restoration and recovery from a failed manual rollback.
- Built-app Chromium checks measure actual cup descent, falling liquid and splash visibility, all five automatically selected products and sideways image travel, manual selection/product links, true pause, responsive layouts, authenticated admin theme/font consistency and reduced motion. The final run covered 13 viewport checks with no browser runtime errors, configured product-to-cart flow, matching explicit dark mode, a populated admin dashboard and unsaved theme-preview cleanup.

New art lives under `public/experience/`. Existing menu images/prices and ordering APIs remain in use. The generated interior is an atmospheric illustration, identified as such in the visit section.

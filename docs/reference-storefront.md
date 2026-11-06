# Cafe motion and shared identity

The previous homepage chose one chai item and overrode its own colour palette. It now selects up to five real, varied menu items and uses the same root colour/type tokens as the menu, login and admin.

## Hero behavior

- Five stable product buttons move between left, right and centre positions every 5.2 seconds. Featured products rank first, with category variety filling the remaining slots; a single featured Kashmiri chai no longer pins the whole hero to one item. Current names, descriptions, base prices and product links change with selection.
- The selected product's current menu photo is the central object. Its own ingredients burst outward during a 4.8-second sequence. Kashmiri chai has pink liquid and droplets; green/black qehwa and coffee have distinct liquid colours. Milk and ice layers appear only when listed in the recipe. Parathas use flour/crumbs, cheese pull, chocolate/cream drizzle or ghee effects according to their ingredients. Eggs and chanay have a heat/sizzle treatment; rolls and malai also have their own profiles. These are composited photographic sprites and SVG/CSS animation, not a WebGL fluid simulator.
- Click any orbiting dish to change the central photo, recipe, effect, description, price and ordering link together. Clicking the same dish again replays the sequence. The image must finish loading before its animation/autoplay starts; missing photos have a labelled fallback.
- `Choose a dish` searches the available homepage catalog by English/Urdu name, category or ingredients. Selecting an item outside the initial five brings it into the orbit. `View ingredients` opens the complete current recipe; up to eight ingredient objects appear in the animated scene. Labels and recipe membership come directly from menu data. Empty recipes are identified explicitly; unfamiliar ingredients keep their actual label with a neutral icon. Packaging is excluded.
- A sticky scroll sequence lowers/scales the selected object further as visitors scroll. Short phones use normal document flow so the scene and controls remain reachable. Small-screen layout reserves room above the fixed bottom navigation. Product selection, previous/next, pause and replay controls remain usable.
- Animations pause when the tab is hidden, the hero is offscreen, a dialog is open, or a keyboard user focuses its controls. Pointer clicks do not accidentally leave autoplay permanently paused. Reduced-motion users get a static product and ingredient labels with manual product choices, without the effects or pinned scrolling. The recipe/chooser dialogs use the same focus trap, Escape handling, body scroll lock and focus return as admin dialogs.
- Unavailable, zero-stock and packaging items are excluded. Small/empty menus do not invent duplicates. Product choices remain links to the actual option picker/menu; decorative chai artwork does not bypass ordering validation.

## One theme

The homepage no longer defines its own `--c-*` palette. Root tokens supply a consistent palette throughout the storefront and admin, including header/sidebar treatments and a shared serif heading font. Admin Settings offers ten presets, with private previews and admin-only publishing. Visitors retain Light/System/Dark controls using matching brand variants; no personal preference means the exact saved house preset. The hero surround follows these tokens while food art retains its original colours.

For this rollout, `CAFE_SHARED_THEME=chai` selects the shared Chai house palette after the pre-release backup. This is a single `CafeSetting.theme` update, not a schema migration. Theme preview/save continues through admin settings.

## Backup and rollback

The guarded deploy wrapper retains Git source, production build, `.env`, uploaded files and the cafe database. `CAFE_SHARED_THEME=chai` additionally saves the old theme value in the checksummed snapshot before changing it. Failure recovery and manual rollback restore the old code/build and that one theme field when present. Current orders, menu data, uploads and `.env` are preserved; the database dump is never automatically imported. Older snapshots without a saved theme retain their existing behavior.

Snapshots remain under `/var/backups/engineer-cafe/release-*`; `/var/backups/engineer-cafe/latest/rollback.sh` restores the most recent saved release. Keep the exact printed path to restore a particular snapshot after future releases.

No new production dependency or Prisma schema/migration is required. Native VPS build and HTTPS/asset checks run during deployment. Isolated local integration checks use the external QA-only official Prisma PostgreSQL/WASM adapter described in `storefront-upgrade.md`; it is not deployed.

## Validation

- Five selector/slot/default tests, including the reported one-featured-Kashmiri case. Six theme tests exercise all ten presets, paired reading modes, restricted preset IDs and prepaint/runtime consistency.
- Eight recipe/effect tests cover every ingredient in the seeded food menu, accurate drink/food families, admin recipe edits, no invented milk/ice/butter, unknown/empty/duplicate/Urdu recipes, and availability/packaging exclusions. Existing mobile/auth/premium/storefront tests also pass.
- Twelve disposable-repository release tests with real Git/archive/checksum operations and mocked PM2/Docker/HTTP. Cases include build/asset/backup failures, immutable snapshot verification, later rollback, palette restoration and recovery from a failed manual rollback, including the new Ocean/Royal/Espresso presets.
- Built-app Chromium checks verify visible pink liquid, flour bursts, animated cheese strands, same-item replay, synchronized photos/recipes, multiple autoplay changes, eight additional choices from the whole menu, modal search/focus/Escape/pause, and required-option product-to-cart flow. Nine layouts from 320 to 1920px include short 568/667px phones. The shared admin notification modal and reduced-motion manual selection also pass, with no browser runtime or artwork-loading errors. Prior checks covered shared admin/storefront palette/fonts, explicit dark mode and theme-preview cleanup.

New art lives under `public/experience/`. Two transparent ingredient atlases provide 32 sprite cells, with English/Urdu aliases resolved in `src/lib/dish-experience.ts`. The extra atlas is requested only when its ingredients appear. Both files join the deployment's byte-for-byte HTTPS artwork checks. Existing menu images/prices and ordering APIs remain in use; this upgrade does not reseed the production menu. The generated interior is an atmospheric illustration, identified as such in the visit section.

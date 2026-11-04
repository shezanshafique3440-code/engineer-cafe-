# Reference-led cafe storefront

Reference-led storefront prepared for release. Git publication and the VPS rollout are separate steps.

The supplied eight-second reference shows a warm caramel/cream cafe page, a central glass cup with a sculpted splash, floating ingredients, atmospheric transitions and cream editorial sections. The implementation adapts that visual direction to Engineer Cafe's chai and paratha menu. It builds an interactive page rather than embedding the recording of a laptop.

## Design and behavior

- New three-scene hero: signature, golden hour and ritual. Scenes change the headline, atmospheric background, lighting and ribbon positions. The central custom-generated chai artwork has gentle floating motion, bounded pointer parallax and a small scroll offset.
- Previous/next, direct scene selection and a pause control. Automatic rotation and decoration pause while the hero is outside the viewport, the tab is hidden, or a control has keyboard focus. Reduced-motion preferences disable autoplay and decorative transforms; manual scene choices remain usable.
- Cream/gold palette and serif wordmark/headings are scoped to the homepage. Other storefront pages retain the configured theme; admin is unaffected. Existing uploaded cafe logos remain supported.
- Photo collections, an editorial cafe story, a filtered signature menu, a visit section, approved customer reviews and links to discovery, meal planning and comparison.
- Category cards use existing product photos and current base prices. Hidden categories, zero-stock and unavailable items are excluded from homepage recommendations. Prices, prep statistics, ratings, online-order status, contact information and service choices come from existing data/settings.
- Product cards retain real option dialogs, favorites, comparison, cart pricing and recently viewed history. The hero's product link opens a current chai product rather than buying an illustrated drink without options.
- The generated interior is atmospheric artwork, not a claimed photograph of the actual premises. Its visit-section caption identifies it as an illustration. The real address, opening-hours text and map query remain driven by cafe settings.

## Assets and scope

`public/experience/signature-chai.webp` and `cafe-atmosphere.webp` are newly generated brand artwork, optimized as WebP (about 482 KiB combined). No third-party brand assets, new production dependencies, environment changes or database migrations are required. Existing menu uploads, prices and orders are unchanged.

Local integration testing uses the isolated PostgreSQL QA database and the same external, QA-only official Prisma JS/WASM adapter preload documented in `storefront-upgrade.md`. This helper is outside the repository and is not part of deployment. Native Prisma build and final live checks remain part of an approved VPS rollout.

## Validation

Production compilation, type checking and ESLint passed. Real Chromium checks against the isolated PostgreSQL app cover 320, 360, 390, 600, 768, 1024, 1440 and 1920 pixels. Checks exercise scene selection/pause/autoplay, reduced-motion behavior, phone navigation and staff-login access, live category filtering, required product options, actual cart additions, saved pickup preference and route-scoped styling. No browser runtime errors or failed image requests were observed. Production data was not used or modified.

## Deployment and retained rollback

After fetching the exact reviewed commit, extract and run `scripts/deploy-reference-storefront.sh` outside the checkout. It rejects tracked edits, dependency/schema differences and insufficient disk space. Before the update, it stops only `engineer-cafe` briefly to snapshot its Git source, `.env`, production build (without regenerable `.next/cache`), uploads and the dedicated `engineer_cafe` PostgreSQL database. Archives and checksums are verified before the existing guarded updater runs. Other PM2 apps and Nginx configuration are not changed.

Snapshots are private directories under `/var/backups/engineer-cafe/release-*`. Each contains a standalone `rollback.sh`. `/var/backups/engineer-cafe/latest` points to the newest complete snapshot. The immutable archives remain available after either automatic recovery or a later manual rollback. The updater also retains its previous-build backup. The cafe has a maintenance window while its build is replaced.

The wrapper checks the cinematic homepage, discovery/comparison routes, selection API, and both new artwork files through HTTPS. Any failure attempts recovery from the verified snapshot.

For manual rollback, run `bash /var/backups/engineer-cafe/latest/rollback.sh` or use the exact backup path printed during deployment. The helper stages a copy of the old build, pins the old Git commit, restarts only the cafe and checks local/HTTPS responses. The replaced build and commit are preserved in a separate recovery subdirectory.

**Rollback restores code/build only.** Current database contents, orders, uploads and `.env` stay in place so orders or menu edits made since deployment are not erased. The database dump, uploads archive, environment backup and source archive are disaster-recovery snapshots, not automatic database-restore instructions. Keep the exact backup path if subsequent releases move the `latest` pointer.

Release safety is additionally covered by seven disposable-repository tests using real Git/archive/checksum operations and mocked PM2, Docker and HTTP services. They cover retained backups and later rollback, failed builds, wrong served artwork, failed database dumps, checksum tampering, failed manual rollback recovery, and tracked-edit refusal. Run with `python3 -m unittest discover -s scripts/tests -v`. These tests do not connect to a VPS or restore a database.

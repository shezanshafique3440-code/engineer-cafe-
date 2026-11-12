# Simple counter workflow review

Local branch: `codex/simple-counter-workflow`, based on released `8c12296027dfd02cc4afec3cd78ac8e672828161`.

## Result

The daily home, desktop sidebar and mobile navigation prioritize New sale, Orders, Kitchen and Cash closing for users whose existing grants allow them. Waiter and kitchen logins retain appropriate daily actions. All existing owner business, report, website and system routes remain available through the searchable All tools & administration directory. The layout does not grant access or replace employee records with mandatory logins.

The counter status bar shows a checked connection, this login's local pending/review bills and the current or explicitly cached cash shift. Its small API is authenticated, read-only and private/no-store. Failed server requests are not labeled Online. Uncertain normal counter requests count as pending until confirmed or recovered, with their original UUID and payload retained. Cash closing checks both these requests and the offline outbox. Storage errors block the checklist rather than reporting zero bills. Cross-tab hints refresh status without submitting bills.

The saved cash shell has the same three status summaries and protects an unfinished bill when following online-only navigation. Its shell cache version is updated without changing the IndexedDB version or deleting the outbox. Offline money, pricing, commission and synchronization rules are unchanged.

English help is available at `/admin/guide`. See `client-quick-start.md` and `client-trial-checklist.md` for handover and acceptance testing.

## Verification scope

- Production build, TypeScript, lint and 80 unit checks pass locally.
- Isolated PostgreSQL integration/browser suites pass 850 assertions (704 in the main run, then 146 everyday-role/responsive checks), plus 32 simultaneous first-settings requests. They cover migrations, accounting, permissions, riders, immutable records, Excel exports, draft handoff, lost responses and offline recovery. Both new counter checks and the updated everyday browser suite are included in the integration runner for future CI runs.
- The new real Chromium suite passes 48 checks for navigation, role grants, shift scope, mobile layout, pending recovery, cash closing and offline status. It confirms that its local UI trial creates no server orders or financial journals.
- Screenshots and logs are in `/workspace/artifacts/simple-counter`.
- The deployment wrapper accepts the previous audited release; shell syntax checked locally. No VPS deployment was performed.

## Operational handover still requires real devices

No live database, demo cleanup, real opening balances, owner accounts, domain or VPS services were changed. Production recovery/health has not been verified in this turn. The client still needs a router/WAN and physical printer trial, real stock/balance review, marked-demo cleanup review, backup/isolated-restore confirmation and final-domain decision. Sync old-domain bills before changing origin or clearing device storage. The closing checklist covers this browser/login only; reconcile other devices and cashier accounts as well.

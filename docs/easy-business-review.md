# Easier business inputs — local review

The work continues on `codex/simple-counter-workflow`; no push or production deployment is authorized for this review.

## Implemented

- Stock entry accepts kg/g, litres/mL and pieces while retaining the existing database base measures. Conversion uses exact decimal arithmetic; incompatible measures, excessive precision and oversized converted quantities are rejected. Unit switching preserves the same canonical amount.
- Ingredients have plain measurement choices, alerts in familiar units, search, low-stock filtering, direct edit/waste/count actions, and a clear ingredient → purchase → recipe path. Editing keeps the stock measure fixed. Stock history remains accessible separately.
- Purchases follow supplier/invoice → ingredient quantities/costs → actual payment → live total/balance → review/confirm. Accounts appear when a payment is entered. Missing supplier/ingredient setup is explained. Review does not post stock or money.
- Recipe review shows batch quantities and per-sale consumption, with optional notes/cost suggestions separate. Non-food services can retain the existing no-ingredients path.
- Physical stock counts accept familiar units and keep the existing draft/review/post process.
- Shared forms support optional details, readable errors, optional explicit review, frozen review payloads, unchanged request IDs on retry and a synchronous submission lock. Fields reset after successful saves. Invalid collapsed fields open before browser validation focuses them.
- Employee forms emphasize name/job/pay/joining date; overtime, codes, notes, leaving date and login creation are optional details. Blank employee/rider codes are generated only when saving. Staff search is available. Existing login, attendance and payroll permissions remain unchanged.
- Supplier payments, expenses, rider cash and commission transactions have explicit review. Previous transactions and detailed histories remain available.
- Business screens prioritize their task. History/date filters/Excel exports are grouped; switching tasks remains available, with a direct All tools link at the top. Existing routes, reports and role checks are preserved.

## Evidence

Verification uses the disposable localhost `cafe_operations_test` database and real Chromium. The new client scenario covers supplier creation, a 2 kg alert, a 2.5 kg purchase with a partial payment, unit-switch identity, recipe quantities per sale, non-food service recipes, draft stock counts, an actual expense, employee creation without a login, attendance, rider codes and 320/390/768/1440px layouts. It verifies stored quantities, supplier balances and posted records rather than only screenshots.

Final production build, TypeScript and lint pass. All 84 unit checks and 917 integration/browser assertions pass, with 32 simultaneous settings-initialization reads checked separately. The 67 client-input assertions are included in the full integration runner.

Final test logs and screenshots are in `/workspace/artifacts/easy-business`. Physical printer/router checks, live VPS status, real opening data and reviewed demo cleanup remain separate operational work. No live database or VPS services were changed.

## Deployment entry point

`scripts/deploy-simple-counter.sh` validates Node 22, the production origin, secret presence, Nginx and an exclusive deployment/recovery lock. It invokes the existing snapshot/database-backup/rollback installer. If the exact previously observed 8c12296 deployment is stopped with its build missing, it can first recover code/build/dependencies from the explicitly known private snapshot. It does not guess another snapshot or restore a database dump. Run the pinned script through a persistent systemd unit. Shell syntax and unchanged baseline permission grants were checked locally; actual VPS deployment requires the operator to run the supplied commands.

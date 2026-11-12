# Clean release type checks

Deployment of `01cc501` reached TypeScript and rejected the tuple spread in `src/lib/__tests__/stock-units.test.ts` with TS2556. The earlier incremental results missed this error. A fresh compiler invocation reproduced it locally.

The test now destructures each case into `raw`, `unit` and `base` and passes them explicitly, preserving all assertions. Both the typecheck command and TypeScript configuration disable incremental caching. No application behavior, dependency versions, database schema or records are changed by this correction.

The persistent deployment entry point now extracts a clean target source tree and compiles it before stopping cafe services when installed dependencies/schema match the target. It uses a private directory, a read-only dependency link, no `.env`, and no Next/typecheck cache. The old release fails this preflight with the original TS2556 error. Changed dependencies/schema still use the guarded installer's checks after installation. The original backup and rollback stages remain in place.

Checks and reproduction logs are retained at `/workspace/artifacts/deploy-typecheck-fix`. Production deployment and public health require the operator to run the corrected pinned command.

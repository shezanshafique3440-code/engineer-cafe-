#!/usr/bin/env bash
# Read-only release compilation. Source is extracted without .env, node_modules
# or .next caches; the running application's files and PM2 services are untouched.
set -euo pipefail
umask 077
TARGET=${1:?Supply the full reviewed release SHA}
CHECK=${2:?Supply a new private check directory}
[[ "$TARGET" =~ ^[0-9a-f]{40}$ ]]
APP=$(pwd -P)
git cat-file -e "$TARGET^{commit}"
test -f node_modules/typescript/bin/tsc
mkdir -m 700 "$CHECK"
git archive "$TARGET" | tar -x -C "$CHECK"
ln -s "$APP/node_modules" "$CHECK/node_modules"
# These are Next's ambient declarations; generated route checks run during build.
printf '%s\n' '/// <reference types="next" />' '/// <reference types="next/image-types/global" />' > "$CHECK/next-env.d.ts"
(
 cd "$CHECK"
 node --max-old-space-size=1024 node_modules/typescript/bin/tsc --noEmit --incremental false
)
echo 'PASS: clean target TypeScript preflight; no cafe services stopped.'

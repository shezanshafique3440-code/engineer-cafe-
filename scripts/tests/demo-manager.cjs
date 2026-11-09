const path = require("node:path"),
  Module = require("node:module");
require("@next/env").loadEnvConfig(process.cwd(), false);
const u = new URL(process.env.DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(u.hostname) ||
  u.pathname != "/cafe_demo_cleanup_test"
)
  throw Error("Only the disposable local demo cleanup database is permitted.");
const local = Module.createRequire(path.join(process.cwd(), "package.json")),
  resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  return name === "server-only"
    ? local.resolve("next/dist/compiled/server-only/empty.js")
    : resolve.call(this, name, parent, ...args);
};
local("tsx/cjs");
const { run } = local("./scripts/tests/demo-manager-test.ts");
const { prisma } = local("./src/lib/prisma.ts");
run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

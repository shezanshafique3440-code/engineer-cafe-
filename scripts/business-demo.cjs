/** CLI adapter only. No change to the running Next.js module resolution. */
const path = require("node:path");
const Module = require("node:module");
const local = Module.createRequire(path.join(process.cwd(), "package.json"));
// The reviewed files execute under /var/backups, outside the app's ancestor tree.
// Make installed app dependencies visible to their bare imports in this CLI only.
process.env.NODE_PATH = [
  path.join(process.cwd(), "node_modules"),
  process.env.NODE_PATH,
]
  .filter(Boolean)
  .join(path.delimiter);
Module._initPaths();

if (!process.env.DATABASE_URL)
  throw Error("Load the cafe .env before running the demo importer.");
if (!process.env.CAFE_DEMO_SOURCE)
  throw Error("Missing reviewed demo source file.");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  return name === "server-only"
    ? local.resolve("next/dist/compiled/server-only/empty.js")
    : resolve.call(this, name, parent, ...args);
};
local("tsx/cjs");
const loaded = require(path.resolve(process.env.CAFE_DEMO_SOURCE));
const db = local(path.join(process.cwd(), "src/lib/prisma.ts")).prisma;
const run =
  loaded.prepareClientHandover ??
  loaded.finishBusinessSetup ??
  loaded.seedBusinessPractice ??
  loaded.seedBusinessDemo;
run(process.argv.includes("--apply"))
  .catch((e) => {
    console.error(
      "Data preparation stopped. Completed batches are retry-safe; inspect the progress above before retrying.",
    );
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

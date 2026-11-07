/** CLI adapter only. No change to the running Next.js module resolution. */
const path = require("node:path");
const Module = require("node:module");
const local = Module.createRequire(path.join(process.cwd(), "package.json"));
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
const { seedBusinessDemo } = require(
  path.resolve(process.env.CAFE_DEMO_SOURCE),
);
const db = local(path.join(process.cwd(), "src/lib/prisma.ts")).prisma;
seedBusinessDemo(process.argv.includes("--apply"))
  .catch((e) => {
    console.error("DEMO import failed; its transaction was rolled back.");
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

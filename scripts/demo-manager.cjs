// Dedicated process: web requests only queue jobs. Resolving server-only here is
// limited to this CLI; the web server uses the normal Next.js resolver.
const path = require("node:path"),
  Module = require("node:module");
require("@next/env").loadEnvConfig(process.cwd(), false);
const local = Module.createRequire(path.join(process.cwd(), "package.json"));
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  return name === "server-only"
    ? local.resolve("next/dist/compiled/server-only/empty.js")
    : resolve.call(this, name, parent, ...args);
};
local("tsx/cjs");
const { tick } = local("./scripts/demo-manager-worker.ts");
const { prisma } = local("./src/lib/prisma.ts");
let stop = false;
process.on("SIGINT", () => {
  stop = true;
});
process.on("SIGTERM", () => {
  stop = true;
});
(async () => {
  do {
    try {
      await tick();
    } catch {
      console.error("Demo worker unavailable; queued jobs will be retried.");
      process.exitCode = 1;
      if (process.argv.includes("--once")) break;
    }
    if (!stop && !process.argv.includes("--once"))
      await new Promise((r) => setTimeout(r, 3000));
  } while (!stop && !process.argv.includes("--once"));
  await prisma.$disconnect();
})();

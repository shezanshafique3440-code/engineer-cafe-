/** Only a freshly migrated disposable DB; no server is running yet. */
const assert = require("node:assert/strict"),
  Module = require("node:module"),
  path = require("node:path");
const url = new URL(process.env.DATABASE_URL);
assert.ok(
  ["127.0.0.1", "localhost"].includes(url.hostname) &&
    url.pathname === "/cafe_operations_test",
);
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  return name === "server-only"
    ? require.resolve("next/dist/compiled/server-only/empty.js")
    : resolve.call(this, name, parent, ...rest);
};
require("tsx/cjs");
const { prisma } = require(path.join(process.cwd(), "src/lib/prisma.ts"));
const { getSettings } = require(
  path.join(process.cwd(), "src/server/settings.ts"),
);
(async () => {
  try {
    assert.equal(await prisma.user.count(), 0, "Fresh disposable DB required");
    assert.equal(
      await prisma.cafeSetting.count(),
      0,
      "No existing settings may be overwritten",
    );
    const rows = await Promise.all(
      Array.from({ length: 32 }, () => getSettings()),
    );
    assert.equal(rows.length, 32);
    assert.ok(rows.every((row) => row.id === 1));
    assert.equal(await prisma.cafeSetting.count(), 1);
    // Return the fresh fixture DB to its initial empty state before business-fixture.cjs.
    await prisma.cafeSetting.delete({ where: { id: 1 } });
    console.log(
      "PASS: 32 simultaneous first settings reads create exactly one singleton without errors.",
    );
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

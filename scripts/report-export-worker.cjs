// One isolated, read-only export. Binary uses its own descriptor, never log stdout.
const path = require("node:path"),
  fs = require("node:fs"),
  Module = require("node:module");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  return name === "server-only"
    ? require.resolve("next/dist/compiled/server-only/empty.js")
    : resolve.call(this, name, parent, ...args);
};
require("tsx/cjs");
const { completeReport, allReportFiles, reportBounds } = require(
  path.join(process.cwd(), "src/server/reports/complete-report.ts"),
);
const { findReportModule } = require(
  path.join(process.cwd(), "src/lib/report-modules.ts"),
);
const { HttpError } = require(path.join(process.cwd(), "src/server/api.ts"));
const { prisma } = require(path.join(process.cwd(), "src/lib/prisma.ts"));
process.once("message", async (input) => {
  let code = 0;
  try {
    if (
      !input ||
      !["xlsx", "zip"].includes(input.format) ||
      (input.module && !findReportModule(input.module))
    )
      throw new HttpError(400, "Choose a valid report.");
    const url = new URL("http://localhost/report");
    url.searchParams.set("from", input.from);
    url.searchParams.set("to", input.to);
    const bounds = reportBounds(url);
    const buffer =
      input.format === "zip"
        ? await allReportFiles(bounds, input.actorName)
        : await completeReport(bounds, input.actorName, input.module);
    fs.writeFileSync(3, Buffer.from(buffer));
  } catch (error) {
    code = 1;
    if (error instanceof HttpError && process.send)
      process.send({ status: error.status, error: error.message });
  } finally {
    await prisma.$disconnect();
    process.exit(code);
  }
});

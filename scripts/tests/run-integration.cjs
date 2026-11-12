/** Destructive ONLY to the explicitly named disposable localhost test DB. */
const fs = require("node:fs"),
  path = require("node:path"),
  { spawn, spawnSync } = require("node:child_process");
const root = process.cwd();
const url = new URL(process.env.DATABASE_URL);
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  url.pathname !== "/cafe_operations_test"
)
  throw Error(
    "Set DATABASE_URL to the disposable localhost cafe_operations_test database.",
  );
const base = "http://127.0.0.1:4188";
const env = {
  ...process.env,
  NEXT_PUBLIC_SITE_URL: base,
  CAFE_TEST_DATABASE: "cafe_operations_test",
  CAFE_BUSINESS_TEST_URL: base,
  CAFE_REPORT_TEST_URL: base,
  CAFE_STARTUP_TEST_URL: base,
  CAFE_STARTUP_TEST_OWNER_ID: "business-owner",
  CAFE_TEST_PG_MODULE: path.join(root, "scripts/tests/pg-connection.cjs"),
};
let server;
const run = (file, args = []) => {
  const result = spawnSync(file, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) throw Error(`${file} ${args.join(" ")} failed`);
};
const delay = () => new Promise((r) => setTimeout(r, 250));
async function stop() {
  if (!server) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((r) => server.once("exit", r)),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  server = null;
}
async function start() {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "4188",
    ],
    { cwd: root, env, stdio: ["ignore", "ignore", "inherit"] },
  );
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) return;
    } catch {}
    await delay();
  }
  throw Error("Test server failed health check");
}
(async () => {
  const { Client } = require("pg");
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const db = new Client({ connectionString: String(admin) });
  await db.connect();
  try {
    await db.query("DROP DATABASE IF EXISTS cafe_operations_test WITH (FORCE)");
    await db.query("CREATE DATABASE cafe_operations_test");
  } finally {
    await db.end();
  }
  run("./node_modules/.bin/prisma", ["migrate", "deploy"]);
  run(process.execPath, ["scripts/tests/settings-concurrency.cjs"]);
  run(process.execPath, ["scripts/tests/business-fixture.cjs"]);
  for (const file of [
    "business-integration.cjs",
    "operations-integration.cjs",
    "operations-audit.cjs",
    "staff-permissions-integration.cjs",
    "delivery-offline-integration.cjs",
    "delivery-offline-browser.cjs",
    "complete-report-integration.cjs",
    "complete-report-browser.cjs",
    "hardening-integration.cjs",
    "hardening-browser.cjs",
    "simple-counter-browser.cjs",
    "offline-startup-browser.cjs",
    "easy-cafe-browser.cjs",
    "easy-business-browser.cjs",
  ]) {
    await start();
    try {
      run(process.execPath, ["scripts/tests/" + file]);
    } finally {
      await stop();
    }
  }
  console.log(
    "PASS: isolated migrations, finance, permissions, delivery, offline, reports and hardening suites.",
  );
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(stop);

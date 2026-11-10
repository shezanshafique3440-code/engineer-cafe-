/** Cold-device, delayed cache install and old-cache upgrade regressions.
 * Uses real Chromium/IndexedDB/service workers, local HTTP fixtures only.
 * No production requests or database writes. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path");
const { spawnSync } = require("node:child_process");
const { chromium } = require(
  process.env.CAFE_TEST_PLAYWRIGHT_MODULE || "playwright",
);
const base = process.env.CAFE_STARTUP_TEST_URL || "http://127.0.0.1:4185";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Local app required",
);
assert.ok(process.env.AUTH_SECRET, "Explicit isolated test secret required");
const dbUrl = new URL(process.env.DATABASE_URL || "http://invalid");
assert.ok(
  ["localhost", "127.0.0.1"].includes(dbUrl.hostname) &&
    ["/cafe_demo_cleanup_test", "/cafe_operations_test"].includes(
      dbUrl.pathname,
    ),
  "Explicit disposable local test environment required",
);
const root = process.cwd();
let mode = "delayed",
  delayed = [],
  checks = 0;
const owner = {
  id: process.env.CAFE_STARTUP_TEST_OWNER_ID || "demo-qa-owner",
  name: "Offline test owner",
  email: "owner@example.test",
  role: "ADMIN",
};
const fixture = {
  user: owner,
  savedAt: new Date().toISOString(),
  shift: {
    id: "test-shift",
    drawer: { name: "Test cash", accountId: "test-cash" },
  },
  products: [
    { id: "test-chai", name: "Test chai", price: 100, addonGroups: [] },
  ],
  settings: {
    cafeName: "Test cafe",
    city: "Islamabad",
    taxPercent: 0,
    deliveryFee: 80,
  },
  sessions: [],
};
const old = new Map(
  [
    "sw.js",
    "offline-pos.html",
    "offline-pos.js",
    "offline-pos-store.js",
    "offline.html",
  ].map((f) => {
    const p = spawnSync("git", ["show", "587af3c:public/" + f], {
      encoding: "utf8",
    });
    assert.equal(p.status, 0);
    return ["/" + f, p.stdout];
  }),
);
const json = (res, data, status = 200) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
const proxy = http.createServer((req, res) => {
  const route = new URL(req.url, "http://fixture").pathname;
  if (route === "/api/auth/me")
    return json(res, { user: mode === "signed-out" ? null : owner });
  if (route === "/api/admin/offline-pos") {
    if (req.method === "HEAD") {
      res.writeHead(200, { "X-Cafe-Offline-Protocol": "1" });
      res.end();
      return;
    }
    if (req.method === "POST")
      return json(
        res,
        { error: "Isolated fixture keeps this bill pending." },
        503,
      );
    if (mode === "signed-out" || mode === "expired-pos")
      return json(
        res,
        { error: "Please sign in to prepare this counter." },
        401,
      );
    return json(res, {
      ...fixture,
      shift: mode === "no-shift" ? null : fixture.shift,
    });
  }
  if (route === "/api/admin/sales-context")
    return json(res, {
      enabled: true,
      accounts: [{ id: "test-cash", code: "CASH_MAIN", name: "Test cash" }],
      sessions: [],
      customers: [],
      shift: fixture.shift,
    });
  if (route === "/api/admin/push")
    return json(res, { configured: false, publicKey: null });
  if (route === "/api/admin/orders/pulse")
    return json(res, { pendingCount: 0, latest: null });
  if (mode === "old" && old.has(route)) {
    res.setHeader(
      "Content-Type",
      route.endsWith(".js") ? "application/javascript" : "text/html",
    );
    res.end(old.get(route));
    return;
  }
  if (route === "/offline-pos.js" && mode === "delayed") {
    delayed.push(res);
    return;
  }
  if (route === "/offline-pos.js" && mode === "failed-cache") {
    res.writeHead(503);
    res.end("Fixture install failure");
    return;
  }
  const target = new URL(base);
  const upstream = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: req.headers.host },
    },
    (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502);
    res.end("Local test server unavailable");
  });
  req.pipe(upstream);
});
const eq = (a, b, message) => {
  assert.equal(a, b, message);
  checks++;
};
async function poll(fn, message) {
  for (let n = 0; n < 100; n++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(message);
}
(async () => {
  await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + proxy.address().port;
  const { SignJWT } = await import("jose");
  const token = await new SignJWT(owner)
    .setSubject(owner.id)
    .setIssuer("engineer-cafe")
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CAFE_TEST_CHROMIUM || undefined,
    args: ["--no-sandbox"],
  });
  const context = async () => {
    const c = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await c.addCookies([{ name: "ec_session", value: token, url: origin }]);
    return c;
  };
  try {
    const c = await context(),
      page = await c.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/admin/pos");
    await poll(
      () => delayed.length > 0,
      "Offline cache did not request its assets",
    );
    eq(
      await page
        .getByRole("heading", { name: "✓ Offline counter ready" })
        .count(),
      0,
      "Do not claim ready before cache installs",
    );
    eq(
      await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      false,
    );
    mode = "ready";
    for (const response of delayed) {
      response.setHeader("Content-Type", "application/javascript");
      response.end(fs.readFileSync(path.join(root, "public/offline-pos.js")));
    }
    delayed = [];
    await page
      .getByRole("heading", { name: "✓ Offline counter ready" })
      .waitFor();
    checks++;
    eq(
      await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      true,
    );
    await c.setOffline(true);
    await page.goto(origin + "/offline-pos.html");
    await page.locator("#editor").waitFor({ state: "visible" });
    checks++;
    assert.match(
      await page.locator("#message").innerText(),
      /Counter ready offline/,
    );
    checks++;
    await page.locator("select[name=product]").selectOption("test-chai");
    await page.locator("input[name=cashReceived]").fill("100");
    await page
      .getByRole("button", { name: "Save provisional bill", exact: true })
      .click();
    let id;
    await poll(async () => {
      const bills = await page.evaluate(
        async (owner) => await CafeOfflinePOS.list(owner),
        owner.id,
      );
      id = bills[0]?.id;
      return Boolean(id);
    }, "Offline bill did not save");
    await page.reload();
    await page.getByText(id, { exact: false }).first().waitFor();
    checks++;
    eq(
      await page.evaluate(
        async (owner) => (await CafeOfflinePOS.list(owner)).length,
        owner.id,
      ),
      1,
      "Reload retains the original local bill",
    );
    const out = process.env.CAFE_TEST_ARTIFACTS;
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      await page.screenshot({
        path: path.join(out, "offline-counter-mobile.png"),
        fullPage: true,
      });
    }
    eq(errors.length, 0, "No startup exceptions");
    await c.close();
    mode = "no-shift";
    const missing = await context(),
      p = await missing.newPage();
    await p.goto(origin + "/offline-pos.html");
    await p
      .locator("#setup-reason")
      .filter({ hasText: "No cash shift" })
      .waitFor();
    checks++;
    eq(await p.locator("#editor").isVisible(), false);
    eq(
      await p
        .getByRole("link", { name: "Open cash shift", exact: true })
        .count(),
      1,
    );
    mode = "ready";
    await p
      .getByRole("button", { name: "Refresh prepared menu & shift" })
      .click();
    await p.locator("#editor").waitFor({ state: "visible" });
    checks++;
    await p.goto(origin + "/admin/pos");
    await p.getByRole("heading", { name: "✓ Offline counter ready" }).waitFor();
    mode = "expired-pos";
    await p.getByText("Device status / Sync / Help", { exact: true }).click();
    await p.getByRole("button", { name: "Prepare / sync this device" }).click();
    await p.getByRole("status").filter({ hasText: "Please sign in" }).waitFor();
    eq(
      await p.getByRole("heading", { name: "✓ Offline counter ready" }).count(),
      0,
      "Expired permission must not keep the cached ready label",
    );
    await missing.close();
    mode = "signed-out";
    const anonymous = await context(),
      a = await anonymous.newPage();
    await a.goto(origin + "/offline-pos.html");
    await a.locator("#message").filter({ hasText: "Please sign in" }).waitFor();
    eq(await a.locator("#setup").isVisible(), true);
    eq(await a.locator("#editor").isVisible(), false);
    await anonymous.close();
    mode = "failed-cache";
    const failed = await context(),
      f = await failed.newPage();
    await f.goto(origin + "/admin/pos");
    await f
      .getByRole("status")
      .filter({ hasText: /Offline files could not be installed/ })
      .waitFor();
    eq(
      await f.getByRole("heading", { name: "✓ Offline counter ready" }).count(),
      0,
    );
    await failed.close();
    mode = "old";
    const legacy = await context(),
      l = await legacy.newPage();
    await l.goto(origin + "/offline-pos.html");
    await l.locator("#editor").waitFor({ state: "visible" });
    await l.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
    });
    await l.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    const originalId = "11111111-1111-4111-8111-111111111111";
    await l.evaluate(
      async ({ owner, id }) =>
        CafeOfflinePOS.queue(
          owner,
          {
            requestId: id,
            shiftId: "test-shift",
            accountId: "test-cash",
            lines: [{ productId: "test-chai", quantity: 1, addonIds: [] }],
            expectedLineTotals: [100],
            expectedTotal: 100,
            cashReceived: 100,
            customerName: "Preserved pending bill",
            serviceMode: "TAKEAWAY",
            offline: true,
          },
          { cafeName: "Test cafe", lines: [], subtotal: 100, tax: 0 },
        ),
      { owner: owner.id, id: originalId },
    );
    mode = "ready";
    await l.goto(origin + "/admin/pos");
    await l.getByRole("heading", { name: "✓ Offline counter ready" }).waitFor();
    const bill = await l.evaluate(
      async ({ owner, id }) =>
        (await CafeOfflinePOS.list(owner)).find((b) => b.id === id),
      { owner: owner.id, id: originalId },
    );
    eq(bill.state, "pending");
    eq(bill.payload.requestId, originalId);
    eq(
      await l.evaluate(async () =>
        (await caches.keys()).some(
          (k) => k === "cafe-shell-v4-english-counter",
        ),
      ),
      false,
    );
    await legacy.setOffline(true);
    await l.goto(origin + "/admin/pos");
    await l.locator("#editor").waitFor({ state: "visible" });
    await l.getByText(originalId, { exact: false }).first().waitFor();
    checks++;
    await legacy.close();
    console.log(
      `PASS: ${checks} cold-start, cache-readiness, direct-link, no-shift, login, offline reload and pending-bill upgrade checks.`,
    );
  } finally {
    await browser.close();
    proxy.closeAllConnections();
    proxy.close();
  }
})().catch((e) => {
  console.error(e);
  proxy.closeAllConnections();
  proxy.close();
  process.exit(1);
});

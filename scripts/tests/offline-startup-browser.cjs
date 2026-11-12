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
const accepted = new Set();
const proxy = http.createServer((req, res) => {
  // Chrome can start a new service-worker target after CDP offline emulation
  // is applied. Also block the origin itself so a restart cannot accidentally
  // fetch a live homepage and turn this into a false offline test.
  if (mode === "physical-offline") return;
  const route = new URL(req.url, "http://fixture").pathname;
  if (route === "/api/auth/me") {
    if (mode === "wan-stalled") return;
    if (mode === "wan-down" || mode === "session-unavailable") {
      res.writeHead(503, { "Content-Type": "text/html" });
      res.end("Temporary network gateway failure");
      return;
    }
    return json(res, { user: mode === "signed-out" ? null : owner });
  }
  if (route === "/api/admin/offline-pos") {
    if (req.method === "HEAD") {
      res.writeHead(200, { "X-Cafe-Offline-Protocol": "1" });
      res.end();
      return;
    }
    if (
      req.method === "POST" &&
      (mode === "sync-ready" || mode === "drop-post")
    ) {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const payload = JSON.parse(body);
        accepted.add(payload.requestId);
        if (mode === "drop-post") return; // committed fixture response is lost
        json(
          res,
          {
            order: {
              id: "official-" + payload.requestId,
              orderNumber: "EC-TEST-1",
              paymentStatus: "PAID",
              total: payload.expectedTotal,
            },
          },
          201,
        );
      });
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
    if (mode === "wan-stalled") return;
    if (mode === "slow-prepare") {
      setTimeout(() => json(res, fixture), 2000);
      return;
    }
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
  for (let n = 0; n < 350; n++) {
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
    await page.goto(origin + "/admin/pos?online=1");
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
    await p.goto(origin + "/admin/pos?online=1");
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
    await f.goto(origin + "/admin/pos?online=1");
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
    await l.goto(origin + "/admin/pos?online=1");
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
    // Block the HTTP origin as well: Chromium may start a new worker target
    // outside CDP offline emulation after an upgrade.
    mode = "physical-offline";
    await legacy.setOffline(true);
    await l.goto(origin + "/admin/pos?online=1");
    await l.locator("#editor").waitFor({ state: "visible" });
    await l.getByText(originalId, { exact: false }).first().waitFor();
    checks++;
    await legacy.close();
    // The ordinary cash-counter entry point itself must work without a mode
    // switch, including a complete browser restart and a stalled upstream WAN.
    mode = "ready";
    const os = require("node:os");
    const profile = fs.mkdtempSync(
      path.join(os.tmpdir(), "cafe-offline-reopen-"),
    );
    let persistent;
    try {
      persistent = await chromium.launchPersistentContext(profile, {
        headless: true,
        executablePath: process.env.CAFE_TEST_CHROMIUM || undefined,
        args: ["--no-sandbox"],
        viewport: { width: 390, height: 844 },
      });
      await persistent.addCookies([
        {
          name: "ec_session",
          value: token,
          url: origin,
          expires: Math.floor(Date.now() / 1000) + 3600,
        },
      ]);
      let cash = await persistent.newPage();
      await cash.goto(origin + "/admin/pos");
      await cash.getByRole("heading", { name: "Counter POS", exact: true }).waitFor();
      eq(new URL(cash.url()).pathname, "/admin/pos", "New Sale stays on normal POS online");
      await cash.getByText("✓ Offline counter ready", { exact: true }).waitFor();
      await persistent.setOffline(true);
      await cash
        .getByRole("heading", { name: "Cash counter", exact: true })
        .waitFor();
      await persistent.setOffline(false);
      await cash.locator("#editor").waitFor({ state: "visible" });
      eq(
        new URL(cash.url()).pathname,
        "/offline-pos.html",
        "Losing connectivity switches the normal POS to the offline counter",
      );
      await cash.goto(origin + "/admin/pos");
      await cash.getByRole("heading", { name: "Counter POS", exact: true }).waitFor();
      eq(new URL(cash.url()).pathname, "/admin/pos", "An installed worker also keeps online New Sale on normal POS");
      mode = "physical-offline";
      await cash.getByRole("heading", { name: "Cash counter", exact: true }).waitFor({ timeout: 30000 });
      eq(new URL(cash.url()).pathname, "/offline-pos.html", "WAN loss also switches without a browser offline event");
      mode = "slow-prepare";
      await cash.reload();
      await cash.locator("#editor").waitFor({ state: "visible" });
      await cash.locator("select[name=product]").selectOption("test-chai");
      await cash.locator("input[name=customerName]").fill("Keep this draft");
      await cash.locator("input[name=cashReceived]").fill("100");
      await cash
        .locator("#message")
        .filter({ hasText: "Review your current bill" })
        .waitFor();
      eq(
        await cash.locator("input[name=customerName]").inputValue(),
        "Keep this draft",
        "A late menu refresh must not erase the bill being entered",
      );
      eq(await cash.locator("select[name=product]").inputValue(), "test-chai");
      eq(await cash.locator("input[name=cashReceived]").inputValue(), "100");
      mode = "physical-offline";
      await persistent.setOffline(true);
      await cash.locator("select[name=product]").selectOption("test-chai");
      await cash.locator("input[name=cashReceived]").fill("100");
      await cash
        .getByRole("button", { name: "Save provisional bill", exact: true })
        .click();
      let saved;
      await poll(async () => {
        saved = await cash.evaluate(
          async (user) => (await CafeOfflinePOS.list(user))[0],
          owner.id,
        );
        return Boolean(saved);
      }, "Cash sale did not save without internet");
      eq(saved.state, "pending");
      const savedId = saved.id;
      await persistent.close();
      persistent = null;
      persistent = await chromium.launchPersistentContext(profile, {
        headless: true,
        executablePath: process.env.CAFE_TEST_CHROMIUM || undefined,
        args: ["--no-sandbox"],
        offline: true,
        viewport: { width: 390, height: 844 },
      });
      cash = await persistent.newPage();
      const restartErrors = [];
      cash.on("pageerror", (e) => restartErrors.push(e.message));
      await cash.goto(origin + "/");
      try {
        await cash
          .getByRole("heading", { name: "Cash counter", exact: true })
          .waitFor({ timeout: 10000 });
      } catch (error) {
        console.error(
          "REOPEN_DIAGNOSTIC",
          JSON.stringify({
            url: cash.url(),
            errors: restartErrors,
            details: await cash.evaluate(async () => ({
              text: document.body.innerText.slice(0, 1600),
              store: Boolean(window.CafeOfflinePOS),
              snapshot: await window.CafeOfflinePOS?.snapshot(),
              controller: Boolean(navigator.serviceWorker.controller),
              caches: await caches.keys(),
            })),
          }),
        );
        throw error;
      }
      await cash.locator("#editor").waitFor({ state: "visible" });
      eq(
        (
          await cash.evaluate(
            async (user) => (await CafeOfflinePOS.list(user))[0],
            owner.id,
          )
        ).id,
        savedId,
        "Offline app restart retains the pending cash order",
      );
      mode = "wan-down";
      await persistent.setOffline(false);
      await cash
        .getByRole("button", { name: "Synchronize now", exact: true })
        .click();
      await cash
        .locator("#message")
        .filter({ hasText: "temporarily unavailable" })
        .waitFor();
      eq(
        await cash.locator("#editor").isVisible(),
        true,
        "A server outage must not close the counter",
      );
      mode = "wan-stalled";
      const started = Date.now();
      await cash.reload({ waitUntil: "domcontentloaded" });
      await cash.locator("#editor").waitFor({ state: "visible" });
      eq(
        await cash.evaluate(() => navigator.onLine),
        true,
        "Wi-Fi can remain online during a WAN failure",
      );
      assert.ok(
        Date.now() - started < 3000,
        "Warm cash counter should open from cache without a stalled navigation",
      );
      checks++;
      await cash.locator("select[name=product]").selectOption("test-chai");
      await cash.locator("input[name=cashReceived]").fill("100");
      await cash
        .getByRole("button", { name: "Save provisional bill", exact: true })
        .click();
      await poll(
        async () =>
          (await cash.evaluate(
            async (user) => (await CafeOfflinePOS.list(user)).length,
            owner.id,
          )) === 2,
        "Second WAN-outage order was not saved",
      );
      checks++;
      await new Promise((r) => setTimeout(r, 5500));
      eq(
        await cash.locator("#editor").isVisible(),
        true,
        "A timed-out session check keeps local cash entry available",
      );
      // Recover the server without dispatching focus/online events. The retry
      // timer must pick up both durable bills using their original UUIDs.
      mode = "sync-ready";
      await poll(
        async () =>
          await cash.evaluate(
            async (user) =>
              (await CafeOfflinePOS.list(user)).every(
                (b) => b.state === "synced",
              ),
            owner.id,
          ),
        "Pending bills did not auto-sync after WAN recovery",
      );
      eq(
        accepted.size,
        2,
        "Both original UUIDs synchronize after WAN recovery",
      );
      eq(
        (
          await cash.evaluate(
            async (user) => (await CafeOfflinePOS.list(user)).map((b) => b.id),
            owner.id,
          )
        ).includes(savedId),
        true,
      );
      mode = "drop-post";
      await cash.locator("select[name=product]").selectOption("test-chai");
      await cash.locator("input[name=cashReceived]").fill("100");
      await cash
        .getByRole("button", { name: "Save provisional bill", exact: true })
        .click();
      let lostId;
      await poll(async () => {
        const local = await cash.evaluate(
          async (user) => await CafeOfflinePOS.list(user),
          owner.id,
        );
        lostId = local.find((b) => b.state === "pending")?.id;
        return Boolean(lostId && accepted.has(lostId));
      }, "Online bill was not durably saved before its lost response");
      await persistent.close();
      persistent = null;
      mode = "sync-ready";
      persistent = await chromium.launchPersistentContext(profile, {
        headless: true,
        executablePath: process.env.CAFE_TEST_CHROMIUM || undefined,
        args: ["--no-sandbox"],
      });
      cash = await persistent.newPage();
      await cash.goto(origin + "/offline-pos.html");
      await cash.locator("#editor").waitFor({ state: "visible" });
      await poll(
        async () =>
          await cash.evaluate(
            async ({ user, id }) =>
              (await CafeOfflinePOS.list(user)).find((b) => b.id === id)
                ?.state === "synced",
            { user: owner.id, id: lostId },
          ),
        "Lost online response did not recover after reopening",
      );
      eq(
        accepted.size,
        3,
        "The online lost-response bill retries its original UUID, not a new sale",
      );
    } finally {
      if (persistent) await persistent.close();
      fs.rmSync(profile, { recursive: true, force: true });
    }
    // The advanced online desk must not turn a connectivity failure into logout.
    mode = "ready";
    const identity = await context(),
      ip = await identity.newPage();
    await ip.goto(origin + "/admin/pos?online=1");
    await ip
      .getByRole("heading", { name: "✓ Offline counter ready" })
      .waitFor();
    await ip.goto(origin + "/admin/tools");
    eq((await ip.locator('a[href="/admin/demo-data"]').count()) > 0, true);
    await identity.setOffline(true);
    await ip.evaluate(() => window.dispatchEvent(new Event("focus")));
    await new Promise((r) => setTimeout(r, 150));
    eq(
      (await ip.locator('a[href="/admin/demo-data"]').count()) > 0,
      true,
      "Offline focus retains the known user",
    );
    mode = "session-unavailable";
    await identity.setOffline(false);
    await ip.evaluate(() => window.dispatchEvent(new Event("focus")));
    await new Promise((r) => setTimeout(r, 300));
    eq(
      (await ip.locator('a[href="/admin/demo-data"]').count()) > 0,
      true,
      "503 is not a logout",
    );
    mode = "signed-out";
    await ip.evaluate(() => window.dispatchEvent(new Event("focus")));
    await poll(
      async () =>
        (await ip.locator('a[href="/admin/demo-data"]').count()) === 0,
      "An authoritative signed-out response was ignored",
    );
    checks++;
    await identity.close();
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

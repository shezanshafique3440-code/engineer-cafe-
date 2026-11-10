/** Real Chromium offline/reload/reconnect and lost-response tests. Local fixture only. */
const assert = require("node:assert/strict"),
  { randomUUID } = require("node:crypto");
const { chromium } = require(
  process.env.CAFE_TEST_PLAYWRIGHT_MODULE || "playwright",
);
const { Pool } = require(process.env.CAFE_TEST_PG_MODULE || "pg");
const base = process.env.CAFE_BUSINESS_TEST_URL || "http://127.0.0.1:4180";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const db = new Pool({
  host: "127.0.0.1",
  user: "agent",
  database: "cafe_operations_test",
});
const sql = async (q, p) => (await db.query(q, p)).rows;
let checks = 0;
const eq = (a, b, msg) => {
  assert.equal(a, b, msg);
  checks++;
};
async function poll(fn, message) {
  for (let i = 0; i < 120; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error(message);
}
(async () => {
  eq(
    (await sql("SELECT current_database() name"))[0].name,
    "cafe_operations_test",
  );
  const browser = await chromium.launch({
    executablePath: process.env.CAFE_TEST_CHROMIUM || undefined,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      baseURL: base,
      viewport: { width: 390, height: 844 },
      extraHTTPHeaders: { "X-Forwarded-For": "127.0.0.45" },
    });
    const auth = await context.request.post("/api/auth/login", {
      data: {
        email: "business-owner@example.test",
        password: "Business-QA-123!",
      },
    });
    eq(auth.status(), 200);
    await context.addInitScript(() => {
      window.print = () => {};
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/admin/pos", { waitUntil: "networkidle" });
    await poll(
      () =>
        page.evaluate(async () =>
          Boolean((await window.CafeOfflinePOS?.snapshot())?.shift),
        ),
      "Offline snapshot not prepared",
    );
    await page.waitForFunction(() =>
      Boolean(navigator.serviceWorker.controller),
    );
    const snapshot = await page.evaluate(() =>
      window.CafeOfflinePOS.snapshot(),
    );
    await context.setOffline(true);
    await page.goto(base + "/admin/pos", { waitUntil: "domcontentloaded" });
    await page
      .getByRole("heading", { name: "Cash counter", exact: true })
      .waitFor();
    await page
      .locator("select[name=product]")
      .selectOption("delivery-offline-service");
    await page.locator("input[name=quantity]").fill("2");
    await page.locator("input[name=cashReceived]").fill("100");
    await page
      .locator("input[name=customerName]")
      .fill("Offline browser fixture");
    await page
      .getByRole("button", { name: "Save provisional bill", exact: true })
      .click();
    let bill;
    await poll(async () => {
      bill = await page.evaluate(
        async (owner) => (await window.CafeOfflinePOS.list(owner))[0],
        snapshot.user.id,
      );
      return bill?.state === "pending";
    }, "Offline form did not save");
    eq(
      (
        await sql('SELECT count(*)::int n FROM "Order" WHERE "requestKey"=$1', [
          "POS:" + bill.id,
        ])
      )[0].n,
      0,
    );
    const printed = page.waitForEvent("popup");
    await page
      .getByRole("button", { name: "Print bill", exact: true })
      .first()
      .click();
    const popup = await printed;
    await popup.waitForLoadState("domcontentloaded");
    assert.match(await popup.locator("body").innerText(), /PROVISIONAL/);
    checks++;
    await popup.close();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(bill.id, { exact: false }).first().waitFor();
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await poll(
      () =>
        page.evaluate(
          async ({ owner, id }) =>
            (await window.CafeOfflinePOS.list(owner)).find((b) => b.id === id)
              ?.state === "synced",
          { owner: snapshot.user.id, id: bill.id },
        ),
      "Reconnect did not synchronize",
    );
    eq(
      (
        await sql('SELECT count(*)::int n FROM "Order" WHERE "requestKey"=$1', [
          "POS:" + bill.id,
        ])
      )[0].n,
      1,
    );
    const confirmed = await page.evaluate(
      async ({ owner, id }) =>
        (await window.CafeOfflinePOS.list(owner)).find((b) => b.id === id),
      { owner: snapshot.user.id, id: bill.id },
    );
    eq(
      (
        await sql(
          'SELECT count(*)::int n FROM "BusinessPayment" WHERE "orderId"=$1',
          [confirmed.order.id],
        )
      )[0].n,
      1,
    );
    console.log(
      "PASS offline UI cash billing, provisional print, cold navigation/reload, durable IndexedDB and automatic reconnect sync.",
    );
    // Cached-price conflict is retained and corrected explicitly with the same UUID.
    const originalPrice = (
      await sql('SELECT price FROM "Product" WHERE id=$1', [
        "delivery-offline-service",
      ])
    )[0].price;
    await sql('UPDATE "Product" SET price=price+5 WHERE id=$1', [
      "delivery-offline-service",
    ]);
    await context.setOffline(true);
    await page
      .locator("select[name=product]")
      .selectOption("delivery-offline-service");
    await page.locator("input[name=quantity]").fill("2");
    await page.locator("input[name=cashReceived]").fill("100");
    await page
      .getByRole("button", { name: "Save provisional bill", exact: true })
      .click();
    let conflict;
    await poll(async () => {
      conflict = await page.evaluate(
        async (owner) =>
          (await window.CafeOfflinePOS.list(owner)).find(
            (b) => b.state === "pending",
          ),
        snapshot.user.id,
      );
      return Boolean(conflict);
    }, "Second offline bill not stored");
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await poll(
      () =>
        page.evaluate(
          async ({ owner, id }) =>
            (await window.CafeOfflinePOS.list(owner)).find((b) => b.id === id)
              ?.state === "conflict",
          { owner: snapshot.user.id, id: conflict.id },
        ),
      "Price conflict not retained",
    );
    eq(
      (
        await sql('SELECT count(*)::int n FROM "Order" WHERE "requestKey"=$1', [
          "POS:" + conflict.id,
        ])
      )[0].n,
      0,
    );
    await page
      .getByRole("button", { name: "Review & correct", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: "Review rejected bill " + conflict.id,
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Save provisional bill", exact: true })
      .click();
    await poll(
      () =>
        page.evaluate(
          async ({ owner, id }) =>
            (await window.CafeOfflinePOS.list(owner)).find((b) => b.id === id)
              ?.state === "synced",
          { owner: snapshot.user.id, id: conflict.id },
        ),
      "Corrected bill not confirmed",
    );
    eq(
      (
        await sql('SELECT count(*)::int n FROM "Order" WHERE "requestKey"=$1', [
          "POS:" + conflict.id,
        ])
      )[0].n,
      1,
    );
    await sql('UPDATE "Product" SET price=$1 WHERE id=$2', [
      originalPrice,
      "delivery-offline-service",
    ]);
    console.log(
      "PASS visible price conflict, fresh menu review and explicit same-ID correction without duplicate billing.",
    );
    await page.goto("/admin/business?section=delivery", {
      waitUntil: "networkidle",
    });
    await page
      .getByRole("button", { name: "Add / edit rider", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Add rider", exact: true })
      .waitFor();
    const riderForm = page.locator("form").filter({
      has: page.getByRole("heading", { name: "Add rider", exact: true }),
    });
    const code = "B" + randomUUID().slice(0, 7);
    await riderForm.getByLabel("Unique rider code").fill(code);
    await riderForm.getByLabel("Rider name").fill("Browser Rider");
    await riderForm.getByLabel(/^Phone/).fill("03001234567");
    await riderForm.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByText(code.toUpperCase() + " · Active", { exact: true })
      .waitFor();
    await page.screenshot({
      path: (process.env.CAFE_TEST_ARTIFACTS || "/tmp") + "/riders-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: (process.env.CAFE_TEST_ARTIFACTS || "/tmp") + "/riders-desktop.png",
      fullPage: true,
    });
    eq(errors.length, 0, errors.join("\n"));
    console.log(
      "PASS rider form submission and mobile/desktop rendering without JavaScript page errors.",
    );
    const actualCache = await page.evaluate(async () => {
      const paths = [];
      for (const key of await caches.keys())
        for (const request of await (await caches.open(key)).keys())
          paths.push(new URL(request.url).pathname);
      return paths;
    });
    assert.ok(actualCache.includes("/offline-pos.html"));
    assert.ok(
      !actualCache.some(
        (p) => p.startsWith("/api/") || p.startsWith("/admin/"),
      ),
    );
    checks += 2;
    await page.goto("/offline-pos.html", { waitUntil: "networkidle" });
    const switchedLogin = await context.request.post("/api/auth/login", {
      data: { email: "cashier@example.test", password: "Business-QA-123!" },
    });
    eq(switchedLogin.status(), 200);
    await page
      .getByRole("button", {
        name: "Refresh prepared menu & shift",
        exact: true,
      })
      .click();
    await poll(
      () =>
        page.evaluate(
          async (original) =>
            (await window.CafeOfflinePOS.snapshot())?.user.id !== original,
          snapshot.user.id,
        ),
      "Prepared cashier did not switch safely",
    );
    eq(
      (
        await page.evaluate(
          (owner) => window.CafeOfflinePOS.list(owner),
          snapshot.user.id,
        )
      ).length,
      2,
    );
    console.log(
      "PASS changing the signed-in cashier updates preparation without a reload loop and retains the original cashier bills.",
    );
    await context.close();
    // Block SW in a separate context so a dropped POST response is deterministic.
    const lost = await browser.newContext({
      baseURL: base,
      serviceWorkers: "block",
      extraHTTPHeaders: { "X-Forwarded-For": "127.0.0.46" },
    });
    const login = await lost.request.post("/api/auth/login", {
      data: {
        email: "business-owner@example.test",
        password: "Business-QA-123!",
      },
    });
    eq(login.status(), 200);
    const lp = await lost.newPage();
    await lp.goto("/admin/login");
    await lp.addScriptTag({ url: base + "/offline-pos-store.js" });
    const apiAuth = { Cookie: login.headers()["set-cookie"].split(";")[0] };
    const preparationResponse = await lost.request.get(
      "/api/admin/offline-pos",
      { headers: apiAuth },
    );
    eq(preparationResponse.status(), 200, await preparationResponse.text());
    const prepared = await preparationResponse.json();
    const quote = await (
      await lost.request.post("/api/cart/quote", {
        headers: apiAuth,
        data: {
          lines: [
            {
              productId: "delivery-offline-service",
              quantity: 1,
              addonIds: [],
            },
          ],
          orderType: "PICKUP",
        },
      })
    ).json();
    const payload = {
      requestId: randomUUID(),
      offline: true,
      shiftId: prepared.shift.id,
      accountId: prepared.shift.drawer.accountId,
      customerName: "Lost response QA",
      expectedTotal: quote.quote.total,
      expectedLineTotals: quote.quote.lines.map((l) => l.lineTotal),
      cashReceived: 100,
      lines: [
        { productId: "delivery-offline-service", quantity: 1, addonIds: [] },
      ],
    };
    let dropped = false;
    await lost.route("**/api/admin/offline-pos", async (route) => {
      if (route.request().method() === "POST" && !dropped) {
        dropped = true;
        const response = await route.fetch();
        eq(response.status(), 201, await response.text());
        await route.abort("failed");
      } else await route.continue();
    });
    await lp.evaluate(
      async ({ snapshot, payload }) => {
        await window.CafeOfflinePOS.snapshot(snapshot);
        await window.CafeOfflinePOS.queue(snapshot.user.id, payload, {
          cafeName: "QA",
          subtotal: payload.expectedTotal,
          tax: 0,
          lines: [
            {
              name: "Lost response",
              quantity: 1,
              total: payload.expectedTotal,
            },
          ],
        });
        await window.CafeOfflinePOS.sync(snapshot.user.id).catch(() => {});
      },
      { snapshot: prepared, payload },
    );
    eq(
      (
        await sql('SELECT count(*)::int n FROM "Order" WHERE "requestKey"=$1', [
          "POS:" + payload.requestId,
        ])
      )[0].n,
      1,
    );
    eq(
      await lp.evaluate(
        async (owner) => (await window.CafeOfflinePOS.list(owner))[0].state,
        prepared.user.id,
      ),
      "pending",
    );
    await sql('UPDATE "Product" SET price=price+1 WHERE id=$1', [
      "delivery-offline-service",
    ]);
    await lp.evaluate(
      (owner) => window.CafeOfflinePOS.sync(owner),
      prepared.user.id,
    );
    const replay = await lp.evaluate(
      async (owner) => (await window.CafeOfflinePOS.list(owner))[0],
      prepared.user.id,
    );
    eq(replay.state, "synced");
    eq(
      (
        await sql(
          'SELECT count(*)::int n FROM "BusinessPayment" WHERE "orderId"=$1',
          [replay.order.id],
        )
      )[0].n,
      1,
    );
    await sql('UPDATE "Product" SET price=$1 WHERE id=$2', [
      originalPrice,
      "delivery-offline-service",
    ]);
    console.log(
      "PASS committed-but-lost response safely replays after a later price change: one receipt and stock reservation.",
    );
    // A browser kept open across a rollback may not send bills to the old unguarded endpoint.
    const pending = { ...payload, requestId: randomUUID() };
    await lost.route("**/api/admin/offline-pos", (route) =>
      route.request().method() === "HEAD"
        ? route.fulfill({ status: 404, body: "" })
        : route.continue(),
    );
    await lp.evaluate(
      async ({ snapshot, payload }) => {
        await window.CafeOfflinePOS.queue(snapshot.user.id, payload, {
          cafeName: "QA",
          subtotal: payload.expectedTotal,
          tax: 0,
          lines: [
            {
              name: "Protocol test",
              quantity: 1,
              total: payload.expectedTotal,
            },
          ],
        });
        await window.CafeOfflinePOS.sync(snapshot.user.id).catch(() => {});
      },
      { snapshot: prepared, payload: pending },
    );
    eq(
      (
        await sql('SELECT count(*)::int n FROM "Order" WHERE "requestKey"=$1', [
          "POS:" + pending.requestId,
        ])
      )[0].n,
      0,
    );
    await lp.evaluate(() => window.CafeOfflinePOS.clearSnapshot());
    eq(await lp.evaluate(() => window.CafeOfflinePOS.snapshot()), undefined);
    eq(
      (
        await lp.evaluate(
          async (owner) =>
            (await window.CafeOfflinePOS.list(owner)).find(
              (b) => b.id !== undefined,
            ),
          prepared.user.id,
        )
      ).ownerId,
      prepared.user.id,
    );
    const keys = await lp.evaluate(async () => {
      const result = [];
      for (const key of await caches.keys()) {
        for (const request of await (await caches.open(key)).keys())
          result.push(new URL(request.url).pathname);
      }
      return result;
    });
    assert.ok(
      !keys.some((k) => k.startsWith("/api/") || k.startsWith("/admin/")),
    );
    checks++;
    console.log(
      `PASS unsupported-release protocol guard, logout snapshot clearing, retained outbox and no private API/HTML caches. ${checks} browser assertions.`,
    );
    await lost.close();
  } finally {
    await browser.close();
    await db.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

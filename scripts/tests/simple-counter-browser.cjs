/** Read-only UI tests. Local outbox fixtures never reach a payment endpoint. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");
const base = process.env.CAFE_BUSINESS_TEST_URL;
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
assert.equal(
  new URL(process.env.DATABASE_URL).pathname,
  "/cafe_operations_test",
);
const db = new PrismaClient(),
  out = process.env.CAFE_TEST_ARTIFACTS || "/tmp/simple-counter";
fs.mkdirSync(out, { recursive: true });
let browser,
  checks = 0;
const eq = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
async function poll(fn, message) {
  for (let i = 0; i < 80; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw Error(message);
}
(async () => {
  try {
    const before = await db.order.count(),
      beforeJournals = await db.businessJournal.count();
    browser = await chromium.launch({
      executablePath: process.env.CAFE_TEST_CHROMIUM,
      headless: true,
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext({
      baseURL: base,
      viewport: { width: 1440, height: 1050 },
      extraHTTPHeaders: { "X-Real-IP": "192.0.2.206" },
    });
    await context.addInitScript(() => {
      window.print = () => {};
      if (typeof SyncManager !== "undefined")
        Object.defineProperty(SyncManager.prototype, "register", {
          configurable: true,
          value: async () => {},
        });
    });
    let writes = 0;
    await context.route("**/api/admin/{offline-pos,pos}", async (route) => {
      if (route.request().method() === "POST") {
        writes++;
        return route.fulfill({
          status: 503,
          json: { error: "UI test deliberately blocks financial writes" },
        });
      }
      return route.continue();
    });
    const anon = await context.request.get("/api/admin/counter-status");
    eq(anon.status(), 401, "Anonymous probe is rejected");
    const auth = await context.request.post("/api/auth/login", {
      data: {
        email: "business-owner@example.test",
        password: "Business-QA-123!",
      },
    });
    eq(auth.status(), 200);
    const cookie = auth.headers()["set-cookie"].split(";")[0];
    const status = await context.request.get("/api/admin/counter-status", {
      headers: { Cookie: cookie },
    });
    eq(status.status(), 200);
    assert.match(status.headers()["cache-control"], /no-store/);
    checks++;
    const server = await status.json();
    const expected = await db.cashShift.findFirst({
      where: {
        openedById: server.actorId,
        closedAt: null,
        drawer: { isActive: true, account: { isActive: true } },
      },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    });
    eq(
      server.shift?.id || null,
      expected?.id || null,
      "Only this actor cash shift is exposed",
    );
    eq(Object.keys(server).sort(), [
      "actorId",
      "checkedAt",
      "enabled",
      "shift",
    ]);
    if (server.shift)
      eq(Object.keys(server.shift).sort(), ["drawer", "id", "openedAt"]);
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/admin");
    await page
      .getByRole("heading", { name: "Daily counter", level: 1, exact: true })
      .waitFor();
    const actions = page.getByRole("region", { name: "Daily actions" });
    eq(
      await actions
        .getByRole("link")
        .allTextContents()
        .then((a) =>
          a.map((t) =>
            t
              .trim()
              .split(/Choose|Website|View|Open/)[0]
              .trim(),
          ),
        ),
      ["New sale", "Orders", "Kitchen", "Cash closing"],
    );
    const bar = page.getByRole("region", { name: "Counter status" });
    await bar.getByText("Online", { exact: true }).waitFor();
    await bar.getByText("No pending bills", { exact: true }).waitFor();
    await page.screenshot({
      path: path.join(out, "daily-counter-desktop.png"),
      fullPage: true,
    });
    await page.goto("/admin/tools");
    await page
      .getByRole("heading", { name: "All tools & administration", exact: true })
      .waitFor();
    const main = page.locator("main");
    for (const href of [
      "/admin/products",
      "/admin/settings",
      "/admin/demo-data",
      "/admin/system",
      "/admin/business?section=staff",
      "/admin/business?section=ledger",
    ])
      eq(
        await main.locator(`a[href="${href}"]`).count(),
        1,
        href + " remains reachable",
      );
    await page
      .getByRole("searchbox", { name: "Search all tools" })
      .fill("inventory");
    eq(
      await main.locator('a[href="/admin/business?section=inventory"]').count(),
      1,
    );
    await page
      .getByRole("searchbox", { name: "Search all tools" })
      .fill("no-such-tool");
    await page.getByText("No matching tools", { exact: true }).waitFor();
    checks++;
    await page.getByRole("button", { name: "Clear tool search" }).click();
    await page.screenshot({
      path: path.join(out, "all-tools-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");
    eq(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "No horizontal overflow on phone",
    );
    await page
      .getByRole("navigation", { name: "Admin quick navigation" })
      .getByRole("button", { name: "Menu", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Admin navigation" })
      .getByRole("link", { name: "All tools & administration", exact: true })
      .waitFor();
    await page.screenshot({
      path: path.join(out, "counter-mobile-menu.png"),
      fullPage: true,
    });
    await page.goto("/admin");
    const intentId = randomUUID();
    await page.evaluate(
      ({ owner, id }) => {
        localStorage.setItem(
          "cafe-sale-intent:COUNTER::" + owner,
          JSON.stringify({
            ownerId: owner,
            endpoint: "/api/admin/pos",
            payload: { requestId: id },
            createdAt: new Date().toISOString(),
          }),
        );
        window.dispatchEvent(new Event("cafe:outbox-changed"));
      },
      { owner: server.actorId, id: intentId },
    );
    await bar.getByText("1 pending sync", { exact: true }).waitFor();
    eq(
      await bar.getByRole("link").first().getAttribute("href"),
      "/admin/pos",
      "Lost online response has recovery link",
    );
    await page.goto("/admin/business?section=cash");
    await page
      .locator("article")
      .filter({
        has: page.getByRole("heading", {
          name: server.shift.drawer.name,
          exact: true,
        }),
      })
      .getByRole("button", { name: "Count & close shift", exact: true })
      .click();
    const closing = page.getByRole("region", { name: "Before closing" });
    await closing
      .getByText("1 saved bills await confirmation, sync or review.", {
        exact: true,
      })
      .waitFor();
    await closing.getByRole("checkbox").check();
    eq(
      await closing
        .getByRole("button", { name: "Next: Count cash", exact: true })
        .isDisabled(),
      true,
      "Unconfirmed online sale blocks closing",
    );
    await closing
      .getByRole("link", {
        name: "Check & recover the last counter bill",
        exact: true,
      })
      .waitFor();
    checks++;
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage))
        if (key.startsWith("cafe-sale-intent:COUNTER::"))
          localStorage.removeItem(key);
      window.dispatchEvent(new Event("cafe:outbox-changed"));
    });
    await poll(
      () =>
        closing
          .getByRole("button", { name: "Next: Count cash", exact: true })
          .isEnabled(),
      "Resolved intent did not unblock checklist",
    );
    checks++;
    await page.goto("/admin/pos?online=1");
    await page
      .getByRole("heading", { name: "✓ Offline counter ready", exact: true })
      .waitFor();
    const snapshot = await page.evaluate(() => CafeOfflinePOS.snapshot());
    assert.ok(snapshot.shift);
    checks++;
    await page.goto("/admin");
    await page.evaluate(
      async ({ owner, id }) => {
        const open = indexedDB.open("cafe-offline-counter", 1);
        const db = await new Promise((r, j) => {
          open.onsuccess = () => r(open.result);
          open.onerror = () => j(open.error);
        });
        await new Promise((r, j) => {
          const tx = db.transaction("bills", "readwrite");
          tx.objectStore("bills").put({
            id,
            ownerId: owner,
            state: "conflict",
            createdAt: new Date().toISOString(),
            payload: { requestId: id, expectedTotal: 20 },
            error: "UI test review only",
          });
          tx.oncomplete = r;
          tx.onerror = j;
        });
        db.close();
        window.dispatchEvent(new Event("cafe:outbox-changed"));
      },
      { owner: server.actorId, id: intentId },
    );
    await bar.getByText("0 pending · 1 need review", { exact: true }).waitFor();
    checks++;
    await context.setOffline(true);
    await bar.getByText("Offline", { exact: true }).waitFor();
    checks++;
    await page.screenshot({
      path: path.join(out, "counter-mobile-offline-status.png"),
      fullPage: true,
    });
    await page.goto("/offline-pos.html");
    await page.locator("#editor").waitFor({ state: "visible" });
    eq(await page.locator("#counter-connection").innerText(), "Offline");
    assert.match(
      await page.locator("#counter-pending").innerText(),
      /1 need review/,
    );
    checks++;
    await page
      .locator("select[name=product]")
      .first()
      .selectOption(
        snapshot.products.find((p) => p.id === "delivery-offline-service").id,
      );
    await page.locator("input[name=customerName]").fill("Unsaved local trial");
    await page.locator("a[data-online-tool]").first().click();
    eq(
      new URL(page.url()).pathname,
      "/offline-pos.html",
      "Offline navigation keeps current local bill",
    );
    eq(
      await page.locator("input[name=customerName]").inputValue(),
      "Unsaved local trial",
    );
    await page.screenshot({
      path: path.join(out, "offline-cash-counter-mobile.png"),
      fullPage: true,
    });
    await context.setOffline(false);
    await page.route("**/api/admin/counter-status", (route) =>
      route.fulfill({ status: 503, json: { error: "Test upstream outage" } }),
    );
    await page.goto("/admin");
    await bar.getByText("Connection unavailable", { exact: true }).waitFor();
    checks++;
    await page.unroute("**/api/admin/counter-status");
    await page.goto("/admin/guide");
    await page.getByRole("heading", { name: /Counter quick start/ }).waitFor();
    await context.close();
    for (const [email, code, heading] of [
      ["cashier@example.test", 200, "Daily counter"],
      ["chef@example.test", 403, "Kitchen desk"],
      ["waiter@example.test", 403, "Table service"],
    ]) {
      const c = await browser.newContext({ baseURL: base });
      const a = await c.request.post("/api/auth/login", {
        data: { email, password: "Business-QA-123!" },
      });
      eq(a.status(), 200, email);
      const r = await c.request.get("/api/admin/counter-status", {
        headers: { Cookie: a.headers()["set-cookie"].split(";")[0] },
      });
      eq(r.status(), code, email + " probe access");
      const p = await c.newPage();
      await p.goto("/admin");
      await p
        .getByRole("heading", { name: heading, level: 1, exact: true })
        .waitFor();
      checks++;
      await p.goto("/admin/tools");
      eq(await p.locator('main a[href="/admin/demo-data"]').count(), 0);
      eq(await p.locator('main a[href="/admin/system"]').count(), 0);
      await c.close();
    }
    eq(errors, [], "No browser runtime errors");
    eq(writes, 0, "Status and local review never submit money or orders");
    eq(
      await db.order.count(),
      before,
      "Read-only UI trial creates no server orders",
    );
    eq(
      await db.businessJournal.count(),
      beforeJournals,
      "Read-only UI trial creates no financial entries",
    );
    console.log(
      `PASS: ${checks} simple-counter navigation, grants, cash status, pending recovery, closing guard, mobile and offline UI checks.`,
    );
  } finally {
    await browser?.close();
    await db.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

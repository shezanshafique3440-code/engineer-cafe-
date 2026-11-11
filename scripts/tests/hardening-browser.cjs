/** Real Chromium regression: online draft handoff and lost-response billing. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { chromium } = require(
  process.env.CAFE_TEST_PLAYWRIGHT_MODULE || "playwright",
);
const base = process.env.CAFE_BUSINESS_TEST_URL;
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
assert.equal(
  new URL(process.env.DATABASE_URL).pathname,
  "/cafe_operations_test",
);
const db = new PrismaClient(),
  out = process.env.CAFE_TEST_ARTIFACTS || "/tmp/cafe-hardening-browser";
fs.mkdirSync(out, { recursive: true });
let browser,
  checks = 0;
const eq = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
async function poll(fn, message) {
  for (let n = 0; n < 100; n++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error(message);
}
(async () => {
  try {
    browser = await chromium.launch({
      executablePath: process.env.CAFE_TEST_CHROMIUM,
      headless: true,
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext({
      baseURL: base,
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: { "X-Real-IP": "192.0.2.224" },
    });
    await context.addInitScript(() => { window.print = () => {}; if (typeof SyncManager !== "undefined") Object.defineProperty(SyncManager.prototype, "register", { configurable:true, value:async()=>{} }); });
    const auth = await context.request.post("/api/auth/login", {
      data: {
        email: "business-owner@example.test",
        password: "Business-QA-123!",
      },
    });
    eq(auth.status(), 200, "Owner signs in");
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/admin/pos");
    await page
      .getByRole("heading", { name: "✓ Offline counter ready", exact: true })
      .waitFor();
    await page.waitForFunction(() =>
      Boolean(navigator.serviceWorker.controller),
    );
    const snapshot = await page.evaluate(() =>
      window.CafeOfflinePOS.snapshot(),
    );
    const product = snapshot.products.find(
      (p) => p.id === "delivery-offline-service",
    );
    assert.ok(product);
    checks++;
    const requestId = require("node:crypto").randomUUID();
    // Use the documented persisted-cart contract, then exercise the real counter.
    await page.evaluate(
      ({ snapshot, product, requestId }) => {
        localStorage.setItem(
          "engineer-cafe-pos-v1",
          JSON.stringify([
            {
              key: product.id + "::::",
              productId: product.id,
              name: product.name,
              slug: product.slug,
              image: product.image,
              unitPrice: product.price,
              addons: [],
              quantity: 2,
              notes: "Draft survives outage",
            },
          ]),
        );
        localStorage.setItem(
          "cafe-counter-draft:" + snapshot.user.id,
          JSON.stringify({
            ownerId: snapshot.user.id,
            lines: [
              {
                productId: product.id,
                quantity: 2,
                addonIds: [],
                notes: "Draft survives outage",
              },
            ],
            cash: "500",
            name: "Restored counter guest",
            account: snapshot.shift.drawer.accountId,
            credit: false,
            party: "",
            approvalId: "",
            requestId,
          }),
        );
      },
      { snapshot, product, requestId },
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "✓ Offline counter ready", exact: true })
      .waitFor();
    await page
      .getByRole("button", {
        name: "Record payment & send ticket",
        exact: true,
      })
      .waitFor();
    await poll(
      () =>
        page
          .getByRole("button", {
            name: "Record payment & send ticket",
            exact: true,
          })
          .isEnabled(),
      "Counter not ready with restored bill",
    );
    await page.screenshot({
      path: path.join(out, "01-counter-desktop.png"),
      fullPage: true,
    });
    await context.setOffline(true);
    await page
      .getByRole("heading", { name: "Cash counter", exact: true })
      .waitFor({ timeout: 30000 });
    eq(
      await page.locator("[name=product]").first().inputValue(),
      product.id,
      "Online product transfers offline",
    );
    eq(
      await page.locator("[name=quantity]").first().inputValue(),
      "2",
      "Online quantity transfers offline",
    );
    eq(
      await page.locator("[name=cashReceived]").inputValue(),
      "500",
      "Online cash transfers offline",
    );
    eq(
      await page.locator("[name=customerName]").inputValue(),
      "Restored counter guest",
      "Online customer transfers offline",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(out, "02-offline-draft-mobile.png"),
      fullPage: true,
    });
    // Native offline changes survive a full reload, too.
    await page.locator("[name=cashReceived]").fill("600");
    await page.reload();
    eq(
      await page.locator("[name=cashReceived]").inputValue(),
      "600",
      "Latest offline cash draft survives reload",
    );
    await page
      .getByRole("button", { name: "Save provisional bill", exact: true })
      .click();
    await poll(
      async () =>
        Boolean(
          (
            await page.evaluate(
              (owner) => window.CafeOfflinePOS.list(owner),
              snapshot.user.id,
            )
          ).find((b) => b.id === requestId),
        ),
      "Transferred draft not queued",
    );
    await context.setOffline(false);
    await page
      .getByRole("button", { name: "Synchronize now", exact: true })
      .click();
    await poll(
      async () =>
        Boolean(
          (
            await page.evaluate(
              (owner) => window.CafeOfflinePOS.list(owner),
              snapshot.user.id,
            )
          ).find((b) => b.id === requestId && b.state === "synced"),
        ),
      "Transferred draft did not synchronize",
    );
    eq(
      await db.order.count({ where: { requestKey: "POS:" + requestId } }),
      1,
      "Transferred draft makes one server order",
    );
    // Simulate commit followed by a lost HTTP response, then reload/recover the exact request.
    await page.goto("/admin/pos");
    await page
      .getByRole("heading", { name: "✓ Offline counter ready", exact: true })
      .waitFor();
    const secondId = require("node:crypto").randomUUID();
    await page.evaluate(
      ({ snapshot, product, secondId }) => {
        localStorage.setItem(
          "engineer-cafe-pos-v1",
          JSON.stringify([
            {
              key: product.id + "::::",
              productId: product.id,
              name: product.name,
              slug: product.slug,
              image: product.image,
              unitPrice: product.price,
              addons: [],
              quantity: 1,
            },
          ]),
        );
        localStorage.setItem(
          "cafe-counter-draft:" + snapshot.user.id,
          JSON.stringify({
            ownerId: snapshot.user.id,
            lines: [{ productId: product.id, quantity: 1, addonIds: [] }],
            cash: "500",
            name: "Lost-response test",
            account: snapshot.shift.drawer.accountId,
            requestId: secondId,
          }),
        );
      },
      { snapshot, product, secondId },
    );
    await page.reload();
    const record = page.getByRole("button", {
      name: "Record payment & send ticket",
      exact: true,
    });
    await poll(() => record.isEnabled(), "Second bill not ready");
    await page.route("**/api/admin/pos", async (route) => {
      await route.fetch();
      await route.abort("failed");
    });
    await record.click();
    await page
      .getByRole("heading", { name: "Confirm your last bill", exact: true })
      .waitFor();
    await poll(
      async () =>
        (await db.order.count({ where: { requestKey: "POS:" + secondId } })) ===
        1,
      "First POST did not commit",
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "Confirm your last bill", exact: true })
      .waitFor();
    eq(
      await page.evaluate(
        (id) =>
          JSON.parse(localStorage.getItem("cafe-sale-intent:COUNTER::" + id))
            .payload.requestId,
        snapshot.user.id,
      ),
      secondId,
      "Reload keeps original submitted request",
    );
    await page.screenshot({
      path: path.join(out, "03-original-bill-recovery.png"),
      fullPage: true,
    });
    await page.unroute("**/api/admin/pos");
    await page
      .getByRole("button", { name: "Check & recover bill", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Counter POS", exact: true })
      .waitFor();
    eq(
      await db.order.count({ where: { requestKey: "POS:" + secondId } }),
      1,
      "Lost response/reload/retry never duplicates sale",
    );
    const stored = await db.order.findFirst({
      where: { requestKey: "POS:" + secondId },
    });
    eq(stored.cashierId, snapshot.user.id, "Cashier attribution persisted");
    eq(stored.cashShiftId, snapshot.shift.id, "Original shift persisted");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/admin/system");
    await page.getByText("Connected", { exact: true }).waitFor();
    await page.screenshot({
      path: path.join(out, "04-system-health.png"),
      fullPage: true,
    });
    await page.goto("/admin/business?section=overview");
    await page
      .getByRole("button", { name: "Download Excel", exact: true })
      .waitFor();
    await page.screenshot({
      path: path.join(out, "05-detailed-reports.png"),
      fullPage: true,
    });
    // An uncertain normal sale can move into the offline outbox unchanged,
    // print the original quote provisionally, then reconcile exactly once.
    await page.goto("/admin/pos");
    await page
      .getByRole("heading", { name: "✓ Offline counter ready", exact: true })
      .waitFor();
    const thirdId = require("node:crypto").randomUUID();
    await page.evaluate(
      ({ snapshot, product, thirdId }) => {
        localStorage.setItem(
          "engineer-cafe-pos-v1",
          JSON.stringify([
            {
              key: product.id + "::::",
              productId: product.id,
              name: product.name,
              slug: product.slug,
              image: product.image,
              unitPrice: product.price,
              addons: [],
              quantity: 1,
            },
          ]),
        );
        localStorage.setItem(
          "cafe-counter-draft:" + snapshot.user.id,
          JSON.stringify({
            ownerId: snapshot.user.id,
            lines: [{ productId: product.id, quantity: 1, addonIds: [] }],
            cash: "500",
            name: "Original request offline recovery",
            account: snapshot.shift.drawer.accountId,
            requestId: thirdId,
          }),
        );
      },
      { snapshot, product, thirdId },
    );
    await page.reload();
    await poll(
      () =>
        page
          .getByRole("button", {
            name: "Record payment & send ticket",
            exact: true,
          })
          .isEnabled(),
      "Recovery fixture not ready",
    );
    await page.route("**/api/admin/pos", async (route) => {
      await route.fetch();
      await route.abort("failed");
    });
    await page
      .getByRole("button", {
        name: "Record payment & send ticket",
        exact: true,
      })
      .click();
    await page
      .getByRole("heading", { name: "Confirm your last bill", exact: true })
      .waitFor();
    await poll(
      async () =>
        (await db.order.count({ where: { requestKey: "POS:" + thirdId } })) ===
        1,
      "Recovery fixture did not commit",
    );
    await context.setOffline(true);
    await page
      .getByRole("heading", { name: "Cash counter", exact: true })
      .waitFor();
    const transferred = await page.evaluate(
      async ({ owner, id }) =>
        (await CafeOfflinePOS.list(owner)).find((b) => b.id === id),
      { owner: snapshot.user.id, id: thirdId },
    );
    eq(
      transferred.endpoint,
      "/api/admin/pos",
      "Original request keeps its original endpoint",
    );
    eq(
      transferred.payload.offline,
      undefined,
      "Original online request is never rewritten as an offline payload",
    );
    eq(
      transferred.receipt.originalQuote,
      true,
      "Original line-price snapshot is preserved",
    );
    eq(transferred.receipt.lines[0].total, product.price, "Recovered receipt preserves the actual quoted line amount");
    const printPopup = page.waitForEvent("popup");
    await page
      .getByRole("button", { name: "Print bill", exact: true })
      .first()
      .click();
    const provisional = await printPopup;
    await provisional.waitForLoadState("domcontentloaded");
    const slip = await provisional.locator("body").innerText();
    assert.ok(
      slip.includes("PROVISIONAL") &&
        slip.includes(product.name),
    );
    checks++;
    await provisional.close();
    await page.unroute("**/api/admin/pos");
    await context.setOffline(false);
    await page
      .getByRole("button", { name: "Synchronize now", exact: true })
      .click();
    await poll(
      async () =>
        await page.evaluate(
          async ({ owner, id }) =>
            (await CafeOfflinePOS.list(owner)).find((b) => b.id === id)
              ?.state === "synced",
          { owner: snapshot.user.id, id: thirdId },
        ),
      "Original online outbox did not confirm",
    );
    eq(
      await db.order.count({ where: { requestKey: "POS:" + thirdId } }),
      1,
      "Uncertain online request through offline outbox still produces one sale",
    );
    const web = await context.request.post("/api/orders", {
      data: {
        requestId: require("node:crypto").randomUUID(),
        lines: [{ productId: product.id, quantity: 1, addonIds: [] }],
        customerName: "QA private customer",
        customerPhone: "03001234567",
        customerEmail: "qa-private@example.test",
        orderType: "PICKUP",
        paymentMethod: "CASH_AT_COUNTER",
        saveAddress: false,
        redeemReward: false,
      },
    });
    eq(
      web.status(),
      201,
      "Unpaid web ticket created for editing/privacy tests",
    );
    const webOrder = (await web.json()).order;
    const guest = await browser.newContext({
      baseURL: base,
      viewport: { width: 390, height: 844 },
    });
    const guestPage = await guest.newPage();
    guestPage.on("pageerror", (e) => errors.push(e.message));
    const publicResponse = await guestPage.goto(webOrder.trackingPath);
    await guestPage
      .getByRole("heading", { name: "Your bill", exact: true })
      .waitFor();
    eq(
      (await guestPage.locator("body").innerText()).includes(
        "QA private customer",
      ),
      false,
      "Guest tracking UI hides contact data",
    );
    eq(
      publicResponse.headers()["referrer-policy"],
      "no-referrer",
      "Tracking capability is excluded from referer headers",
    );
    await guestPage
      .getByRole("button", { name: "Refresh progress", exact: true })
      .click();
    await guestPage.screenshot({
      path: path.join(out, "06-private-tracking-mobile.png"),
      fullPage: true,
    });
    await guest.close();
    await page.goto("/admin/orders");
    await page
      .getByRole("button", {
        name: `View order ${webOrder.orderNumber}`,
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Edit unpaid bill", exact: true })
      .click();
    const editor = page.locator("section").filter({
      has: page.getByRole("heading", {
        name: "Edit unpaid bill",
        exact: true,
      }),
    });
    await editor.getByLabel("Quantity", { exact: true }).fill("2");
    await editor
      .getByRole("button", { name: "Preview revised bill", exact: true })
      .click();
    await editor.getByText(/Revised total:/).waitFor();
    await page.screenshot({
      path: path.join(out, "07-order-edit-preview.png"),
      fullPage: true,
    });
    await editor
      .getByRole("button", { name: "Confirm & save changes", exact: true })
      .click();
    await poll(async () => {
      // Production cookies are Secure. Use the browser's loopback secure context;
      // APIRequestContext intentionally omits Secure cookies over plain HTTP.
      const check = await page.evaluate(async (id) => {
        const response = await fetch("/api/admin/orders/" + id);
        return { status: response.status, body: await response.json() };
      }, webOrder.id);
      if (!check.body.order)
        throw Error(
          `Order edit check HTTP ${check.status}: ${JSON.stringify(check.body)}`,
        );
      return check.body.order.items[0].quantity === 2;
    }, "Order edit UI did not persist");
    checks++;
    await page.goto("/admin/system");
    await page.route("**/api/auth/logout", (route) => route.abort("failed"));
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await page.getByText(/Sign out could not be confirmed/).waitFor();
    const stillSignedIn = await page.evaluate(async () =>
      (await fetch("/api/auth/me")).json(),
    );
    eq(
      stillSignedIn.user.id,
      snapshot.user.id,
      "Failed logout does not pretend session was removed",
    );
    await page.unroute("**/api/auth/logout");
    eq(errors, [], "No browser runtime errors");
    await context.close();
    console.log(
      `PASS: ${checks} durable-draft, offline handoff, reconnect, lost-response recovery and cashier/shift browser checks. Screenshots: ${out}`,
    );
  } finally {
    await browser?.close();
    await db.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

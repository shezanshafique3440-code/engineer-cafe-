/** Everyday role, cash, table and attendance UX. Local disposable fixtures only. */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const { chromium } = require(
  process.env.CAFE_TEST_PLAYWRIGHT_MODULE || "playwright",
);
const base = process.env.CAFE_BUSINESS_TEST_URL || "http://127.0.0.1:4180";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const artifacts = process.env.CAFE_TEST_ARTIFACTS || "/tmp/easy-cafe-browser";
let checks = 0;
const eq = (a, b, msg) => {
  assert.equal(a, b, msg);
  checks++;
};
async function poll(f) {
  for (let i = 0; i < 100; i++) {
    if (await f()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw Error("Timed out waiting for saved UI state");
}
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CAFE_TEST_CHROMIUM || undefined,
    args: ["--no-sandbox"],
  });
  const errors = [];
  const contexts = [];
  try {
    const anonymous = await browser.newContext({ baseURL: base });
    contexts.push(anonymous);
    eq((await anonymous.request.get("/api/admin/day-summary")).status(), 401);
    async function login(email, ip) {
      const context = await browser.newContext({
        baseURL: base,
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
        extraHTTPHeaders: { "X-Real-IP": `192.0.2.${ip}` },
      });
      contexts.push(context);
      const r = await context.request.post("/api/auth/login", {
        data: { email, password: "Business-QA-123!" },
      });
      eq(r.status(), 200, await r.text());
      const headers = { Cookie: r.headers()["set-cookie"].split(";")[0] };
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      const get = async (path) => {
        const r = await context.request.get(path, { headers });
        eq(r.status(), 200, await r.text());
        return r.json();
      };
      const post = async (module, body) => {
        const r = await context.request.post("/api/admin/business/" + module, {
          headers,
          data: { ...body, requestId: randomUUID() },
        });
        eq(r.status(), 200, await r.text());
        return (await r.json()).result;
      };
      return { context, page, get, post, headers };
    }
    fs.mkdirSync(artifacts, { recursive: true });
    for (const [email, primary, forbidden, ip] of [
      ["cashier@example.test", "New sale", "Pay salaries", 101],
      ["waiter@example.test", "Tables & orders", "New sale", 102],
      ["chef@example.test", "Kitchen orders", "Riders & deliveries", 103],
    ]) {
      const a = await login(email, ip);
      await a.page.goto("/admin");
      await a.page
        .getByRole("heading", {
          name: "What would you like to do?",
          exact: true,
        })
        .waitFor();
      eq(
        await a.page
          .locator("main")
          .getByRole("link", {
            name: new RegExp(
              "^" + primary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            ),
          })
          .count(),
        1,
      );
      eq(
        await a.page
          .locator("main")
          .getByRole("link", { name: new RegExp("^" + forbidden) })
          .count(),
        0,
      );
      const summary = await a.get("/api/admin/day-summary");
      if (email !== "cashier@example.test") {
        eq(summary.shift, null);
        eq(summary.unassigned, null);
      }
      await a.page.getByLabel("Current status", { exact: true }).waitFor();
      await a.page.screenshot({
        path: artifacts + "/" + email.split("@")[0] + "-home-mobile.png",
        fullPage: true,
      });
      if (email.startsWith("cashier"))
        await a.page.screenshot({
          path: artifacts + "/cashier-home-mobile-viewport.png",
        });
    }
    const a = await login("business-owner@example.test", 104),
      page = a.page;
    await page.goto("/admin");
    await page
      .getByRole("heading", { name: "What would you like to do?", exact: true })
      .waitFor();
    await page.setViewportSize({ width: 1440, height: 900 });
    const adminNav = page.getByRole("navigation", {
      name: "Admin",
      exact: true,
    });
    for (const label of [
      "Dashboard",
      "Products",
      "Categories",
      "Customers",
      "Coupons",
      "Reviews",
      "Messages",
      "Analytics",
      "Settings",
      "Rewards & scheduling",
      "QR menu studio",
    ]) {
      const link = adminNav.getByRole("link", { name: label, exact: true });
      eq(await link.count(), 1, "Missing admin tool: " + label);
      eq(
        await link.evaluate((el) => Boolean(el.closest("details:not([open])"))),
        false,
        "Admin tool is hidden: " + label,
      );
    }
    await page.goto("/admin/dashboard");
    await page
      .getByRole("heading", { name: "Dashboard", exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        !document.body.innerText.includes("Unable to load dashboard.") &&
        document.querySelector("main table"),
    );
    eq(
      await page
        .getByText("Unable to load dashboard.", { exact: true })
        .count(),
      0,
    );
    await page.goto("/admin");
    const limited = await login("cashier@example.test", 105);
    const limitedUser = (await limited.get("/api/auth/me")).user;
    await a.post("setup", {
      action: "ACCESS",
      userId: limitedUser.id,
      employeeId: limitedUser.employeeId,
      profile: "CASHIER",
      customPermissions: true,
      permissions: ["pos"],
    });
    const limitedSummary = await limited.get("/api/admin/day-summary");
    for (const key of ["orders", "tables", "shift", "unassigned"])
      eq(limitedSummary[key], null, "Masked login leaked " + key);
    await a.post("setup", {
      action: "ACCESS",
      userId: limitedUser.id,
      employeeId: limitedUser.employeeId,
      profile: "CASHIER",
      customPermissions: false,
      permissions: [],
    });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const section of [
        "home",
        "inventory",
        "purchases",
        "attendance",
        "payroll",
        "cash",
        "tables",
        "delivery",
        "setup",
        "overview",
      ]) {
        await page.goto(
          section === "home" ? "/admin" : "/admin/business?section=" + section,
        );
        if (section === "home")
          await page
            .getByRole("heading", {
              name: "What would you like to do?",
              exact: true,
            })
            .waitFor();
        else {
          await page.getByLabel("Workspace", { exact: true }).waitFor();
          await page
            .locator("main")
            .getByLabel("Task steps", { exact: true })
            .waitFor();
          await page.waitForFunction(() =>
            document.querySelector(
              'main form,main table,main [aria-label="Available stock"]',
            ),
          );
        }
        eq(
          await page
            .getByText("Workspace could not load", { exact: true })
            .count(),
          0,
        );
        const size = await page.evaluate(() => ({
          body: document.documentElement.scrollWidth,
          view: innerWidth,
        }));
        assert.ok(
          size.body <= size.view + 2,
          `${section} overflow at ${width}: ${JSON.stringify(size)}`,
        );
        checks++;
        if (width === 1440 && section === "home") {
          await page.getByLabel("Current status", { exact: true }).waitFor();
          await page.screenshot({ path: artifacts + "/easy-home-desktop.png" });
        }
        if (
          width === 390 &&
          [
            "home",
            "tables",
            "delivery",
            "cash",
            "inventory",
            "attendance",
          ].includes(section)
        )
          await page.screenshot({
            path: artifacts + "/easy-" + section + "-mobile.png",
            fullPage: true,
          });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    // Three-step billing: category, exact cash shortcut, one recorded sale.
    await page.goto("/admin/pos");
    await page
      .getByLabel("Find a menu item", { exact: true })
      .fill("Delivery/offline QA service");
    await page
      .getByRole("button", { name: /Delivery\/offline QA service/ })
      .click();
    await page
      .locator("#counter-bill details")
      .filter({ hasText: "Customer name / Extra details" })
      .locator("summary")
      .click();
    const customer = "Easy sale " + randomUUID().slice(0, 8);
    await page
      .getByLabel("Customer name (optional)", { exact: true })
      .fill(customer);
    const billShortcut = page.getByRole("button", {
      name: /items · View bill/,
    });
    const shortcutBox = await billShortcut.boundingBox(),
      menuBox = await page
        .getByRole("navigation", {
          name: "Admin quick navigation",
          exact: true,
        })
        .boundingBox();
    assert.ok(
      shortcutBox &&
        menuBox &&
        shortcutBox.y + shortcutBox.height <= menuBox.y + 2,
      "Mobile bill shortcut overlaps the bottom navigation",
    );
    checks++;
    await page.getByRole("button", { name: /^Exact Rs\./ }).click();
    const paymentResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/admin/pos") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", {
        name: "Record payment & send ticket",
        exact: true,
      })
      .click();
    const payment = await paymentResponse;
    eq(payment.status(), 201, await payment.text());
    const sale = (await payment.json()).order;
    eq(sale.paymentStatus, "PAID");
    eq(Number(sale.cashChange), 0);
    await page
      .getByRole("button", { name: "Print ticket", exact: true })
      .waitFor();
    await page.screenshot({
      path: artifacts + "/easy-pos-mobile.png",
      fullPage: true,
    });
    // Table ticket stays on the same screen and updates the running bill.
    const table = await a.post("tables", {
      action: "SAVE",
      name: "Easy UI " + randomUUID().slice(0, 6),
      seats: 4,
      isActive: true,
    });
    const session = await a.post("tables", {
      action: "OPEN",
      tableId: table.id,
      guestCount: 2,
    });
    await page.goto("/admin/business?section=tables");
    let card = page.locator("article").filter({
      has: page.getByRole("heading", { name: table.name, exact: true }),
    });
    await card
      .getByRole("button", { name: "Add items / send ticket", exact: true })
      .click();
    const desk = page.locator("#table-order-desk");
    await desk
      .getByLabel("Find a menu item", { exact: true })
      .fill("Delivery/offline QA service");
    await desk
      .getByRole("button", { name: /Delivery\/offline QA service/ })
      .click();
    const ticketResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/admin/table-orders") &&
        r.request().method() === "POST",
    );
    await desk
      .getByRole("button", { name: "Send table ticket", exact: true })
      .click();
    eq((await ticketResponse).status(), 201);
    eq(new URL(page.url()).searchParams.get("section"), "tables");
    await card.getByText("Balance due: Rs. 20.00", { exact: true }).waitFor();
    await desk
      .getByRole("button", { name: "← Back to tables & bills", exact: true })
      .click();
    await card
      .getByRole("button", { name: "Receive payment", exact: true })
      .click();
    const pay = page.locator("form").filter({
      has: page.getByRole("heading", {
        name: "Receive table payment",
        exact: true,
      }),
    });
    const salesContext = await a.get("/api/admin/sales-context");
    await pay.getByLabel(/^Amount received/).fill("20");
    await pay
      .getByLabel(/^Received into/)
      .selectOption(salesContext.shift.drawer.accountId);
    await pay.getByLabel(/^Payment reference/).fill("Easy table payment QA");
    await pay
      .getByRole("button", { name: "Record receipt", exact: true })
      .click();
    await card.getByText("Balance due: Rs. 0.00", { exact: true }).waitFor();
    // One-click attendance never overwrites an existing daily entry.
    const employeeName = "Easy Employee " + randomUUID().slice(0, 5);
    const employee = await a.post("staff", {
      name: employeeName,
      code: "E" + randomUUID().slice(0, 7),
      phone: "",
      designation: "Helper",
      payBasis: "DAILY",
      basePay: "1000",
      overtimeRate: "100",
      joinedOn: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi",
      }).format(new Date()),
      isActive: true,
      notes: "",
    });
    await page.goto("/admin/business?section=attendance");
    const emp = page.locator("article").filter({
      has: page.getByRole("heading", {
        name: employeeName,
        exact: true,
      }),
    });
    await emp.getByRole("button", { name: "Present", exact: true }).click();
    await emp.getByText("PRESENT", { exact: true }).waitFor();
    eq(
      await emp.getByRole("button", { name: "Present", exact: true }).count(),
      0,
    );
    await page.getByRole("button", { name: "This month", exact: true }).click();
    await emp.getByText("PRESENT", { exact: true }).waitFor();
    // Close checklist checks durable local bills, then requires explicit review.
    await page.goto("/admin/business?section=cash");
    const cash = await a.get("/api/admin/business/cash"),
      drawer = cash.drawers.find(
        (d) => d.activeShift?.id === salesContext.shift.id,
      );
    const cashCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: drawer.name, exact: true }),
    });
    await cashCard
      .getByRole("button", { name: "Count & close shift", exact: true })
      .click();
    const check = page.getByLabel("Before closing", { exact: true });
    await check
      .getByText(
        "No offline bills are pending for this login on this device.",
        {
          exact: true,
        },
      )
      .waitFor();
    eq(
      await check
        .getByRole("button", { name: "Next: Count cash", exact: true })
        .isDisabled(),
      true,
    );
    await check
      .getByLabel("I have reviewed pending work and bills on other devices", {
        exact: true,
      })
      .check();
    await check
      .getByRole("button", { name: "Next: Count cash", exact: true })
      .click();
    await page.getByLabel(/^Count method/).waitFor();
    await page.screenshot({
      path: artifacts + "/easy-closing-mobile.png",
      fullPage: true,
    });
    const who = (await a.get("/api/auth/me")).user;
    await page.evaluate(async (owner) => {
      const store = window.CafeOfflinePOS;
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open("cafe-offline-counter", 1);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction("bills", "readwrite");
        tx.objectStore("bills").put({
          id: "easy-ui-pending",
          ownerId: owner,
          state: "pending",
          payload: { requestId: "easy-ui-pending", expectedTotal: 20 },
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, who.id);
    await page.reload();
    await cashCard
      .getByRole("button", { name: "Count & close shift", exact: true })
      .click();
    await check
      .getByText("1 offline bills are pending or need review.", {
        exact: true,
      })
      .waitFor();
    await check
      .getByLabel("I have reviewed pending work and bills on other devices", {
        exact: true,
      })
      .check();
    eq(
      await check
        .getByRole("button", { name: "Next: Count cash", exact: true })
        .isDisabled(),
      true,
    );
    await page.evaluate(async () => {
      const db = await new Promise((resolve) => {
        const r = indexedDB.open("cafe-offline-counter", 1);
        r.onsuccess = () => resolve(r.result);
      });
      await new Promise((resolve) => {
        const tx = db.transaction("bills", "readwrite");
        tx.objectStore("bills").delete("easy-ui-pending");
        tx.oncomplete = resolve;
      });
      db.close();
    });
    eq(errors.length, 0, errors.join("\n"));
    console.log(
      `PASS easy home permissions, layouts at four widths, POS cash shortcuts, inline table billing, quick attendance and closing guards. ${checks} assertions.`,
    );
  } finally {
    for (const c of contexts) await c.close();
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

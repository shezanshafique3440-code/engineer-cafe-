import assert from "node:assert/strict";
import { readFileSync, openSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const { chromium } = require("playwright");
const local = parseEnv(readFileSync(".env", "utf8"));
const source = new PrismaClient({
  datasources: { db: { url: local.DATABASE_URL } },
});
const original =
  await source.$queryRaw`SELECT (SELECT count(*)::int FROM "Product") products, (SELECT count(*)::int FROM "Category") categories, (SELECT count(*)::int FROM "Order") orders, (SELECT count(*)::int FROM "User") users`;
const testUrl = new URL(local.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(testUrl.hostname))
  throw new Error("Integration suite requires a local PostgreSQL instance.");
testUrl.pathname = "/engineer_cafe_test";
// Never reset the application database. This disposable database has its own fixed name.
try {
  await source.$executeRawUnsafe("CREATE DATABASE engineer_cafe_test");
} catch (e) {
  if (e.meta?.code !== "42P04") throw e;
}
const db = new PrismaClient({
  datasources: { db: { url: testUrl.toString() } },
});
const env = {
  ...process.env,
  ...local,
  DATABASE_URL: testUrl.toString(),
  NEXT_DIST_DIR: ".next-test",
  PORT: "3001",
};
function command(args) {
  const r = spawnSync("npm", args, { env, encoding: "utf8" });
  if (r.status) throw new Error(r.stdout + r.stderr);
}
command(["run", "db:deploy"]);
const existing = await db.user.count();
if (!existing) command(["exec", "--", "prisma", "db", "seed"]);
await db.cashShift.updateMany({
  where: { closedAt: null },
  data: { closedAt: new Date(), activeKey: null },
});
const base = "http://localhost:3001";
const log = openSync("/workspace/scratch/operations-test-server.log", "w");
const server = spawn(
  "npm",
  ["run", "dev", "--", "--port", "3001", "--hostname", "0.0.0.0"],
  { env, stdio: ["ignore", log, log], detached: true },
);
let browser;
const checks = [];
function pass(s) {
  checks.push(s);
  console.log("PASS", s);
}
try {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(base + "/api/settings");
      if (r.ok) break;
    } catch {}
    if (i === 89)
      throw new Error(
        "Test server not ready. Check /workspace/scratch/operations-test-server.log",
      );
    await new Promise((r) => setTimeout(r, 1000));
  }
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_EXECUTABLE_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const admin = await browser.newContext({ baseURL: base });
  const guest = await browser.newContext({ baseURL: base });
  async function call(ctx, module, body, status = 200) {
    const r = await ctx.request.post(`/api/admin/operations/${module}`, {
      data: body,
    });
    const j = await r.json();
    assert.equal(
      r.status(),
      status,
      `${module}:${body.action}: ${JSON.stringify(j)}`,
    );
    return j;
  }
  async function login(ctx, email, password) {
    const r = await ctx.request.post("/api/auth/login", {
      data: { email, password },
    });
    assert.equal(r.status(), 200, await r.text());
    return (await r.json()).user;
  }
  await login(admin, local.SEED_ADMIN_EMAIL, local.SEED_ADMIN_PASSWORD);
  const tag = randomUUID().slice(0, 8),
    password = "Test-only-long-password-123!";
  const user = (
    await call(admin, "people", {
      action: "user",
      name: "Test cashier",
      email: `cashier-${tag}@example.com`,
      password,
      role: "STAFF",
      permissions: ["pos", "shifts"],
    })
  ).user;
  const staff = await browser.newContext({ baseURL: base });
  await login(staff, `cashier-${tag}@example.com`, password);
  assert.equal((await staff.request.get("/api/admin/settings")).status(), 403);
  assert.equal(
    (
      await staff.request.patch(`/api/admin/customers/${user.id}`, {
        data: { role: "ADMIN" },
      })
    ).status(),
    403,
  );
  await call(staff, "people", { action: "user" }, 403);
  pass("Staff cannot escalate privileges, edit settings or manage users");
  await call(admin, "people", {
    action: "access",
    userId: user.id,
    role: "STAFF",
    isActive: true,
    permissions: ["pos", "shifts", "inventory"],
  });
  assert.equal(
    (await staff.request.get("/api/admin/operations/inventory")).status(),
    200,
  );
  await call(admin, "people", {
    action: "access",
    userId: user.id,
    role: "STAFF",
    isActive: true,
    permissions: ["pos", "shifts"],
  });
  assert.equal(
    (await staff.request.get("/api/admin/operations/inventory")).status(),
    403,
  );
  pass("Permission grants and revocation take effect without a new login");
  const shift = (
    await call(staff, "shifts", { action: "open", openingCash: 500 })
  ).shift;
  const otherShift = (
    await call(admin, "shifts", { action: "open", openingCash: 1000 })
  ).shift;
  const category = await db.category.findFirst();
  const product = await db.product.create({
    data: {
      name: `Test item ${tag}`,
      slug: `test-${tag}`,
      description: "Integration fixture",
      categoryId: category.id,
      price: 200,
      stock: 20,
    },
  });
  const ingredient = (
    await call(admin, "inventory", {
      action: "item",
      name: `Ingredient ${tag}`,
      unit: "piece",
      lowStock: 2,
    })
  ).item;
  const supplier = (
    await call(admin, "inventory", {
      action: "supplier",
      name: `Supplier ${tag}`,
    })
  ).supplier;
  const purchase = await call(admin, "inventory", {
    action: "purchase",
    supplierId: supplier.id,
    reference: `purchase-${tag}`,
    lines: [{ inventoryItemId: ingredient.id, quantity: 100, unitCost: 20 }],
  });
  assert.equal(purchase.purchase.total, 2000);
  await call(admin, "inventory", {
    action: "vendor-payment",
    supplierId: supplier.id,
    amount: 500,
    reference: `vendor-${tag}`,
  });
  await call(admin, "inventory", {
    action: "recipe",
    productId: product.id,
    lines: [{ inventoryItemId: ingredient.id, quantity: 2 }],
  });
  const inv = await (
    await admin.request.get("/api/admin/operations/inventory")
  ).json();
  assert.equal(inv.suppliers.find((s) => s.id === supplier.id).balance, 1500);
  pass("Purchases update weighted stock costs and supplier balances");
  const fractional = (
    await call(admin, "inventory", {
      action: "item",
      name: `Fractional ${tag}`,
      unit: "ml",
      lowStock: 1,
    })
  ).item;
  await call(admin, "inventory", {
    action: "purchase",
    supplierId: (
      await call(admin, "inventory", {
        action: "supplier",
        name: `Fractional supplier ${tag}`,
      })
    ).supplier.id,
    reference: `fraction-${tag}`,
    lines: [{ inventoryItemId: fractional.id, quantity: 100, unitCost: 0.125 }],
  });
  assert.equal(
    Number(
      (await db.inventoryItem.findUnique({ where: { id: fractional.id } }))
        .averageCost,
    ),
    0.13,
  );

  const publicPayload = {
    lines: [{ productId: product.id, quantity: 2, addonIds: [] }],
    orderType: "PICKUP",
    paymentMethod: "CASH_AT_COUNTER",
    customerName: "Pickup Test",
    customerPhone: "03001234567",
  };
  const pickupResponse = await guest.request.post("/api/orders", {
    data: publicPayload,
  });
  assert.equal(pickupResponse.status(), 201, await pickupResponse.text());
  const pickup = (await pickupResponse.json()).order;
  assert.equal(pickup.paymentStatus, "UNPAID");
  assert.equal(pickup.status, "PENDING");
  assert.equal(
    (await guest.request.get(`/api/orders/${pickup.orderNumber}`)).status(),
    404,
  );
  assert.equal(
    (await guest.request.get(`/api/orders/${pickup.id}`)).status(),
    200,
  );
  await guest.request
    .post("/api/orders", {
      data: {
        ...publicPayload,
        orderType: "DELIVERY",
        addressLine: "Test street 12",
        city: "Islamabad",
      },
    })
    .then((r) => assert.equal(r.status(), 400));
  pass(
    "Public pickup remains unpaid/pending; predictable guest order numbers cannot disclose orders",
  );
  const payload = {
    action: "sale",
    clientId: randomUUID(),
    lines: [{ productId: product.id, quantity: 2, addonIds: [] }],
    orderType: "DINE_IN",
    tableNumber: "T1",
    customerName: "Counter Test",
    customerPhone: "",
    shiftId: shift.id,
    discount: 0,
    expectedTotal: 400,
    paid: true,
    paymentMethod: "CASH_AT_COUNTER",
  };
  const [a, b] = await Promise.all([
    call(staff, "pos", payload),
    call(staff, "pos", payload),
  ]);
  assert.equal(a.order.id, b.order.id);
  let item = await db.inventoryItem.findUnique({
    where: { id: ingredient.id },
  });
  assert.equal(Number(item.quantity), 92);
  assert.equal(
    (await db.product.findUnique({ where: { id: product.id } })).stock,
    16,
  );
  assert.equal(
    await db.orderPayment.count({ where: { orderId: a.order.id } }),
    1,
  );
  await call(staff, "pos", { ...payload, expectedTotal: 401 }, 400);
  pass(
    "Concurrent duplicate offline IDs create exactly one sale, payment and stock deduction",
  );
  await call(
    staff,
    "pos",
    { ...payload, clientId: randomUUID(), expectedTotal: 1 },
    400,
  );
  const badStock = {
    ...payload,
    clientId: randomUUID(),
    lines: [{ productId: product.id, quantity: 30, addonIds: [] }],
    expectedTotal: 6000,
  };
  await call(staff, "pos", badStock, 400);
  assert.equal(
    await db.order.count({ where: { clientId: badStock.clientId } }),
    0,
  );
  pass(
    "Price conflicts and insufficient stock roll back the entire transaction",
  );
  await call(staff, "pos", { action: "complete", orderId: a.order.id });
  await call(
    staff,
    "pos",
    {
      action: "payment",
      orderId: a.order.id,
      shiftId: shift.id,
      reference: `refund-staff-${tag}`,
      refund: true,
    },
    403,
  );
  await call(admin, "pos", {
    action: "payment",
    orderId: a.order.id,
    shiftId: otherShift.id,
    reference: `refund-${tag}`,
    refund: true,
  });
  await call(admin, "pos", { action: "cancel", orderId: a.order.id });
  await call(admin, "pos", { action: "cancel", orderId: a.order.id }, 400);
  item = await db.inventoryItem.findUnique({ where: { id: ingredient.id } });
  assert.equal(Number(item.quantity), 96);
  pass(
    "Refund ledger and cancellation restore stock once; repeated cancellation is rejected",
  );
  const unpaid = {
    ...payload,
    clientId: randomUUID(),
    orderType: "PICKUP",
    paid: false,
  };
  const edit = (await call(staff, "pos", unpaid)).order;
  await call(staff, "pos", {
    ...unpaid,
    action: "edit",
    orderId: edit.id,
    lines: [{ productId: product.id, quantity: 3, addonIds: [] }],
    expectedTotal: 600,
  });
  await call(staff, "pos", {
    ...unpaid,
    action: "edit",
    orderId: edit.id,
    lines: [{ productId: product.id, quantity: 1, addonIds: [] }],
    expectedTotal: 200,
  });
  await call(staff, "pos", { action: "cancel", orderId: edit.id });
  assert.equal(
    Number(
      (await db.inventoryItem.findUnique({ where: { id: ingredient.id } }))
        .quantity,
    ),
    96,
  );
  pass(
    "Repeated unpaid bill edits and cancellation keep recipe stock balanced",
  );
  const delivery = (
    await call(admin, "pos", {
      ...payload,
      clientId: randomUUID(),
      orderType: "DELIVERY",
      customerPhone: "03001234567",
      addressLine: "Test address",
      shiftId: otherShift.id,
      paid: false,
      paymentMethod: "CASH_ON_DELIVERY",
      expectedTotal: 480,
    })
  ).order;
  const rider = (
    await call(admin, "delivery", {
      action: "rider",
      code: `R-${tag}`,
      name: "Test Rider",
      phone: "03001234567",
    })
  ).rider;
  await call(admin, "delivery", {
    action: "assign",
    riderId: rider.id,
    orderId: delivery.id,
  });
  for (const status of ["PREPARING", "READY", "OUT_FOR_DELIVERY"])
    await call(admin, "delivery", {
      action: "status",
      orderId: delivery.id,
      status,
    });
  await call(
    admin,
    "delivery",
    { action: "status", orderId: delivery.id, status: "DELIVERED" },
    400,
  );
  await call(admin, "pos", {
    action: "payment",
    orderId: delivery.id,
    shiftId: otherShift.id,
    reference: `delivery-pay-${tag}`,
  });
  await call(admin, "delivery", {
    action: "status",
    orderId: delivery.id,
    status: "DELIVERED",
  });
  assert.equal(
    (await db.order.findUnique({ where: { id: delivery.id } })).commission,
    60,
  );
  const settled = await call(admin, "delivery", {
    action: "settle",
    riderId: rider.id,
    orderIds: [delivery.id],
  });
  assert.equal(settled.amount, 60);
  await call(
    admin,
    "delivery",
    { action: "settle", riderId: rider.id, orderIds: [delivery.id] },
    400,
  );
  pass(
    "Delivery workflow requires rider and payment; 15% commission settles once",
  );
  const employee = (
    await call(admin, "people", {
      action: "employee",
      name: `Employee ${tag}`,
      title: "Cashier",
      monthlySalary: 30000,
    })
  ).employee;
  await call(admin, "people", {
    action: "attendance",
    employeeId: employee.id,
  });
  await call(
    admin,
    "people",
    { action: "attendance", employeeId: employee.id },
    400,
  );
  await call(admin, "people", {
    action: "attendance",
    employeeId: employee.id,
    clockOut: true,
  });
  await call(admin, "people", {
    action: "salary",
    employeeId: employee.id,
    period: "2026-11",
    amount: 30000,
    reference: `salary-${tag}`,
  });
  await call(admin, "finance", {
    action: "expense",
    category: "Utilities",
    description: "Test expense",
    amount: 100,
    reference: `expense-${tag}`,
  });
  pass("Attendance and salary/expense records persist with duplicate guards");
  const shiftReport = await (
    await staff.request.get("/api/admin/operations/shifts")
  ).json();
  assert.equal(
    shiftReport.shifts.find((s) => s.id === shift.id).liveExpected,
    900,
  );
  await call(staff, "shifts", {
    action: "close",
    shiftId: shift.id,
    closingCash: 890,
    handoverToId: (
      await admin.request.get("/api/auth/me").then((r) => r.json())
    ).user.id,
  });
  const closed = await db.cashShift.findUnique({ where: { id: shift.id } });
  assert.equal(closed.variance, -10);
  await call(staff, "pos", { ...payload, clientId: randomUUID() }, 400);
  pass(
    "Drawer reconciliation and handover freeze closed shifts; late offline bills stay conflicts",
  );
  const report = await (
    await admin.request.get(
      "/api/admin/operations/finance?from=2026-11-01&to=2026-11-30",
    )
  ).json();
  assert.ok(report.summary.commission >= 60);
  assert.ok(report.summary.operatingExpenses >= 100);
  assert.ok(report.summary.salaries >= 30000);
  assert.equal(report.vendors.find((v) => v.id === supplier.id).balance, 1500);
  assert.ok(report.products.some((p) => p.name === product.name));
  pass(
    "Financial reports reconcile expenses, salaries, commission, vendor balances and product sales",
  );
  // A fresh shift for browser/offline navigation tests.
  const fresh = (
    await call(staff, "shifts", { action: "open", openingCash: 0 })
  ).shift;
  const page = await staff.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin/pos", { waitUntil: "networkidle" });
  await page.getByText(product.name, { exact: true }).first().waitFor();
  await page.waitForFunction(
    () => window.CafePOS && navigator.serviceWorker.controller,
  );
  const offlinePayload = {
    ...payload,
    clientId: randomUUID(),
    shiftId: fresh.id,
  };
  delete offlinePayload.action;
  await page.evaluate(
    async ({ p, owner }) => {
      await window.CafePOS.queue(owner, p, {
        cafeName: "Test Cafe",
        lines: [{ name: "Offline test", quantity: 2, total: 400 }],
      });
    },
    { p: offlinePayload, owner: user.id },
  );
  await staff.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("heading", { name: "Offline counter", exact: true })
    .waitFor();
  await page.getByText("Counter test", { exact: false }).count();
  await page
    .getByText(offlinePayload.clientId, { exact: false })
    .first()
    .waitFor();
  await page.locator("select[name=product]").selectOption(product.id);
  await page.locator("input[name=quantity]").fill("2");
  await page.locator("input[name=paid]").check();
  await page.getByRole("button", { name: "Save provisional bill" }).click();
  let uiBill;
  for (let i = 0; i < 30; i++) {
    uiBill = await page
      .evaluate(
        async ({ owner, exclude }) =>
          (await window.CafePOS.list(owner)).find((b) => b.id !== exclude),
        { owner: user.id, exclude: offlinePayload.clientId },
      )
      .catch(() => null);
    if (uiBill) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(uiBill, "Offline form did not persist a bill");
  assert.equal(uiBill.payload.expectedTotal, 400);
  await staff.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  let synced = false;
  for (let i = 0; i < 100; i++) {
    const bill = await page.evaluate(
      async ({ owner, id }) =>
        (await window.CafePOS.list(owner)).find((b) => b.id === id),
      { owner: user.id, id: offlinePayload.clientId },
    );
    if (
      bill?.state === "synced" &&
      (await db.order.count({ where: { clientId: uiBill.id } })) === 1
    ) {
      synced = true;
      break;
    }
    if (bill?.state === "conflict")
      throw new Error(`Offline conflict: ${bill.error}`);
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(synced, "Offline bill did not automatically synchronize");
  assert.equal(
    await db.order.count({ where: { clientId: offlinePayload.clientId } }),
    1,
  );
  pass(
    "Service worker reloads offline; IndexedDB bill survives reload and automatically syncs on reconnect",
  );
  for (const path of [
    "/",
    "/menu",
    "/admin/inventory",
    "/admin/people",
    "/admin/shifts",
    "/admin/delivery",
    "/admin/finance",
  ]) {
    const p = await admin.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    const r = await p.goto(path, { waitUntil: "networkidle" });
    assert.equal(r.status(), 200, path);
    await p.close();
  }
  await page.goto("/admin/pos", { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/workspace/scratch/pos-mobile-verified.png",
    fullPage: true,
  });
  await page
    .getByRole("button")
    .filter({ hasText: product.name })
    .first()
    .click();
  assert.equal(
    await page.getByLabel("Quantity", { exact: true }).inputValue(),
    "1",
  );
  const refreshed = page.waitForResponse((r) =>
    r.url().endsWith("/api/auth/me"),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await refreshed;
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page.getByLabel("Quantity", { exact: true }).inputValue(),
    "1",
  );
  pass("Session refresh preserves an unsaved POS bill");
  await call(admin, "people", {
    action: "access",
    userId: user.id,
    role: "STAFF",
    isActive: false,
    permissions: [],
  });
  assert.equal(
    (await staff.request.get("/api/admin/operations/pos")).status(),
    401,
  );
  assert.equal((await staff.request.get("/admin/login")).status(), 200);
  pass(
    "Deactivation blocks API access and leaves login reachable with a stale token",
  );
  assert.deepEqual(errors, []);
  pass(
    "Storefront and all operation screens render; mobile POS has no JavaScript errors",
  );
  const after =
    await source.$queryRaw`SELECT (SELECT count(*)::int FROM "Product") products, (SELECT count(*)::int FROM "Category") categories, (SELECT count(*)::int FROM "Order") orders, (SELECT count(*)::int FROM "User") users`;
  assert.deepEqual(after, original);
  pass("Original application data counts remain unchanged");
  console.log(`${checks.length} integration scenarios passed.`);
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
  await db.$disconnect();
  await source.$disconnect();
}

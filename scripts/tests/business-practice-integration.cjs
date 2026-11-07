/** Uses isolated local fixture accounts. Never point this at the live website. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Pool } = require(process.env.CAFE_TEST_PG_MODULE || "pg");
const base = process.env.CAFE_PRACTICE_TEST_URL || "http://localhost:4176";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const db = new Pool({
  host: "127.0.0.1",
  user: "agent",
  database: "cafe_demo_seed_test",
});
const file = process.env.CAFE_PRACTICE_CREDENTIALS;
assert.ok(file, "Private test credentials file required");
const entries = [
  ...fs
    .readFileSync(file, "utf8")
    .matchAll(
      /(MANAGER|CASHIER|WAITER|CHEF)\nEmail: ([^\n]+)\nPassword: ([^\n]+)/g,
    ),
];
let checks = 0;
const eq = (a, b, m) => {
  assert.equal(a, b, m);
  checks++;
};
let ip = 110;
const sql = async (q, a) => (await db.query(q, a)).rows;
async function login(email, password) {
  let cookie = "";
  const headers = {
    "Content-Type": "application/json",
    "X-Forwarded-For": "192.0.2." + ip++,
  };
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
  });
  eq(r.status, 200, "Fixture login failed");
  cookie = r.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  return async (p, data, status = 200, method) => {
    const r = await fetch(base + p, {
      method: method || (data ? "POST" : "GET"),
      headers: { ...headers, Cookie: cookie },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const value = await r.json();
    eq(r.status, status, p + ": " + JSON.stringify(value));
    return value;
  };
}
const post = (a, module, data) =>
  a("/api/admin/business/" + module, { requestId: randomUUID(), ...data });
(async () => {
  eq(
    (await sql("SELECT current_database()::text AS name"))[0].name,
    "cafe_demo_seed_test",
  );
  const owner = await login("business-owner@example.test", "Business-QA-123!");
  const roles = {};
  for (const [, profile, email, password] of entries)
    roles[profile] = await login(email, password);
  for (const role of Object.values(roles)) {
    await role("/api/admin/business/payroll", null, 403);
    await role("/api/admin/business/ledger", null, 403);
  }
  const catalogue = await owner("/api/meal-catalog");
  eq(
    catalogue.products.some((p) => p.name.startsWith("DEMO")),
    false,
  );
  const context = await roles.CASHIER("/api/admin/sales-context");
  eq(context.enabled, true);
  eq(context.shift.drawer.name, "ASSUMED · Cashier practice till");
  const before = (await owner("/api/admin/business/overview")).revenue;
  const milk = (
    await sql('SELECT quantity::text FROM "Ingredient" WHERE name=$1', [
      "DEMO · Milk",
    ])
  )[0].quantity;
  const counter = (
    await roles.CASHIER(
      "/api/admin/pos",
      {
        requestId: randomUUID(),
        cashReceived: 500.5,
        accountId: context.shift.drawer.accountId,
        expectedTotal: 300,
        lines: [{ productId: "business-chai", quantity: 2, addonIds: [] }],
      },
      201,
    )
  ).order;
  eq(counter.cashChange, 200.5);
  eq(counter.businessTracked, true);
  const status = (a, id, status) =>
    a("/api/admin/orders/" + id, { status }, 200, "PATCH");
  await status(roles.CHEF, counter.id, "PREPARING");
  eq(
    Number(
      (
        await sql('SELECT quantity::text FROM "Ingredient" WHERE name=$1', [
          "DEMO · Milk",
        ])
      )[0].quantity,
    ),
    Number(milk) - 320,
  );
  await status(roles.CHEF, counter.id, "READY");
  await status(roles.CASHIER, counter.id, "DELIVERED");
  const tables = await owner("/api/admin/business/tables");
  const free = tables.tables.find((t) => !t.busy && t.isActive);
  assert.ok(free);
  const session = (
    await post(roles.WAITER, "tables", {
      action: "OPEN",
      tableId: free.id,
      guestCount: 2,
    })
  ).result;
  const ticket = (
    await roles.WAITER(
      "/api/admin/table-orders",
      {
        requestId: randomUUID(),
        sessionId: session.id,
        lines: [{ productId: "business-paratha", quantity: 1, addonIds: [] }],
      },
      201,
    )
  ).order;
  await status(roles.CHEF, ticket.id, "PREPARING");
  await status(roles.CHEF, ticket.id, "READY");
  await status(roles.WAITER, ticket.id, "DELIVERED");
  eq(
    (await owner("/api/admin/orders/" + ticket.id)).order.paymentStatus,
    "UNPAID",
  );
  await post(roles.CASHIER, "tables", {
    action: "PAY",
    sessionId: session.id,
    amount: "200",
    accountId: context.shift.drawer.accountId,
    note: "ASSUMED practice table receipt",
  });
  await post(roles.CASHIER, "tables", {
    action: "CLOSE",
    sessionId: session.id,
  });
  eq(
    Number((await owner("/api/admin/business/overview")).revenue) -
      Number(before),
    500,
  );
  const money = await sql(
    'SELECT SUM(debit-credit)::text AS delta FROM "BusinessPosting"',
  );
  eq(Number(money[0].delta), 0);
  console.log(
    `PASS ${checks} checks: normal menu → cashier POS → chef → table waiter → payment → stock and profit; limited role permissions.`,
  );
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());

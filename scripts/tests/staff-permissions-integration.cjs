// Run after the existing isolated business/operations suites, never on a VPS DB.
const assert = require("node:assert/strict"),
  { randomUUID } = require("node:crypto");
const { Pool } = require(process.env.CAFE_TEST_PG_MODULE || "pg");
const base = process.env.CAFE_BUSINESS_TEST_URL || "http://127.0.0.1:4180";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const db = new Pool({
  host: "127.0.0.1",
  user: "agent",
  database: "cafe_operations_test",
});
const password = "Business-QA-123!";
let checks = 0;
async function login(email) {
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(r.status, 200, await r.clone().text());
  checks++;
  return r.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
}
async function request(cookie, path, body, expected = 200) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await r.json();
  assert.equal(r.status, expected, JSON.stringify(j));
  checks++;
  return j;
}
(async () => {
  assert.equal(
    (await db.query("SELECT current_database() AS name")).rows[0].name,
    "cafe_operations_test",
  );
  const owner = await login("business-owner@example.test"),
    cashier = await login("cashier@example.test");
  const who = (await request(cashier, "/api/auth/me")).user;
  const grant = async (data, expected = 200) =>
    request(
      owner,
      "/api/admin/business/setup",
      {
        action: "ACCESS",
        requestId: randomUUID(),
        userId: who.id,
        profile: "CASHIER",
        employeeId: who.employeeId,
        ...data,
      },
      expected,
    );
  await grant({ customPermissions: true, permissions: ["orders"] });
  await request(cashier, "/api/admin/orders");
  await request(cashier, "/api/admin/sales-context", undefined, 403);
  assert.deepEqual(
    (await request(cashier, "/api/auth/me")).user.businessPermissions,
    ["orders"],
  );
  checks++;
  await grant({ customPermissions: true, permissions: [] });
  await request(cashier, "/api/admin/orders", undefined, 403);
  await grant({ customPermissions: true, permissions: ["finance"] }, 422);
  await request(
    cashier,
    "/api/admin/business/setup",
    {
      action: "ACCESS",
      requestId: randomUUID(),
      userId: who.id,
      profile: "MANAGER",
    },
    403,
  );
  await grant({ customPermissions: false, permissions: [] });
  await request(cashier, "/api/admin/sales-context");
  const bcrypt = require("bcryptjs"),
    id = randomUUID();
  await db.query(
    'INSERT INTO "User" (id,name,email,"passwordHash",role,"updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())',
    [
      id,
      "Unassigned staff",
      "unassigned@example.test",
      await bcrypt.hash(password, 10),
      "STAFF",
    ],
  );
  const unassigned = await login("unassigned@example.test");
  for (const path of [
    "/api/admin/settings",
    "/api/admin/products",
    "/api/admin/orders",
    "/api/admin/sales-context",
  ])
    await request(unassigned, path, undefined, 403);
  await db.query('UPDATE "User" SET "isActive"=false WHERE id=$1', [id]);
  await request(unassigned, "/api/admin/orders", undefined, 401);
  const loginPage = await fetch(base + "/admin/login", {
    headers: { Cookie: unassigned },
    redirect: "manual",
  });
  assert.equal(loginPage.status, 200);
  checks++;
  // Guest pickup must never be paid or completed just by submitting checkout.
  const pickup = await fetch(base + "/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lines: [{ productId: "business-service", quantity: 1, addonIds: [] }],
      customerName: "Public pickup",
      customerPhone: "03001234567",
      orderType: "PICKUP",
      paymentMethod: "CASH_AT_COUNTER",
      saveAddress: false,
      redeemReward: false,
    }),
  });
  const p = await pickup.json();
  assert.equal(pickup.status, 201, JSON.stringify(p));
  assert.equal(p.order.paymentStatus, "UNPAID");
  assert.equal(p.order.status, "PENDING");
  checks += 3;
  console.log(
    `PASS ${checks} compatible staff permission, revocation, login and public pickup checks.`,
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());

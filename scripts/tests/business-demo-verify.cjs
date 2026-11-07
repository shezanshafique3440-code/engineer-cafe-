/** Validate seeded data only in a disposable local accounting database. */
const assert = require("node:assert/strict");
const { Pool } = require(process.env.CAFE_TEST_PG_MODULE || "pg");
const name = process.env.CAFE_DEMO_TEST_DB || "cafe_demo_seed_test";
assert.ok(["cafe_demo_seed_test", "cafe_business_test"].includes(name));
const db = new Pool({ host: "127.0.0.1", user: "agent", database: name });
const rows = async (sql, args) => (await db.query(sql, args)).rows;
let checks = 0;
const eq = (a, b, label) => {
  assert.equal(a, b, label);
  checks++;
};
(async () => {
  eq((await rows("SELECT current_database()::text AS name"))[0].name, name);
  const summary = (
    await rows('SELECT result FROM "BusinessRequest" WHERE key=$1', [
      "business-demo-v1",
    ])
  )[0].result;
  eq(summary.orders, 600);
  eq(summary.staff, 12);
  eq(summary.products, 24);
  eq(summary.customers, 45);
  eq(
    (
      await rows('SELECT COUNT(*)::int AS n FROM "Order" WHERE id LIKE $1', [
        "cafe-demo-v1-order-%",
      ])
    )[0].n,
    600,
  );
  eq(
    (
      await rows(
        'SELECT COUNT(*)::int AS n FROM "Order" WHERE id LIKE $1 AND (NOT "businessTracked" OR "customerName" NOT LIKE $2 OR "customerPhone"<>$3)',
        ["cafe-demo-v1-order-%", "DEMO · %", ""],
      )
    )[0].n,
    0,
  );
  eq(
    (
      await rows(
        'SELECT COUNT(*)::int AS n FROM "User" WHERE id LIKE $1 AND (email NOT LIKE $2 OR role<>$3)',
        ["cafe-demo-v1-customer-user-%", "%@example.test", "CUSTOMER"],
      )
    )[0].n,
    0,
  );
  eq(
    (
      await rows(
        'SELECT COUNT(*)::int AS n FROM "Employee" WHERE code LIKE $1',
        ["DEMO-%"],
      )
    )[0].n,
    12,
  );
  eq(
    (
      await rows(
        'SELECT COUNT(*)::int AS n FROM "Attendance" WHERE id LIKE $1',
        ["cafe-demo-v1-attendance-%"],
      )
    )[0].n,
    summary.attendance,
  );
  eq(
    (
      await rows(
        'SELECT COUNT(*)::int AS n FROM "Product" p JOIN "Category" c ON c.id=p."categoryId" WHERE p.id LIKE $1 AND c."isActive"=true',
        ["cafe-demo-v1-product-%"],
      )
    )[0].n,
    0,
    "Demo products must not appear on the public menu",
  );
  eq(
    (
      await rows(
        'SELECT COUNT(*)::int AS n FROM "BusinessPosting" HAVING SUM(debit)-SUM(credit)<>0',
      )
    ).length,
    0,
    "Trial balance must balance",
  );
  eq(
    (
      await rows(
        'SELECT COUNT(*)::int AS n FROM "Ingredient" WHERE id LIKE $1 AND (quantity<0 OR "stockValue"<0)',
        ["cafe-demo-v1-ingredient-%"],
      )
    )[0].n,
    0,
  );
  const inventory = (
    await rows(
      `SELECT (SELECT SUM("stockValue") FROM "Ingredient" WHERE id LIKE 'cafe-demo-v1-ingredient-%')=(SELECT SUM(p.debit-p.credit) FROM "BusinessPosting" p JOIN "BusinessAccount" a ON a.id=p."accountId" JOIN "BusinessJournal" j ON j.id=p."journalId" WHERE a.code='INVENTORY' AND j."actorId"='cafe-demo-v1-actor-1') AS ok`,
    )
  )[0];
  eq(inventory.ok, true, "Demo inventory must match its ledger");
  const wip = (
    await rows(
      `SELECT COALESCE((SELECT -SUM(m.value) FROM "StockMovement" m JOIN "Order" o ON o.id=m."orderId" WHERE o.id LIKE 'cafe-demo-v1-order-%' AND o.status NOT IN ('DELIVERED','CANCELLED') AND m.kind='PREPARATION'),0)=COALESCE((SELECT SUM(p.debit-p.credit) FROM "BusinessPosting" p JOIN "BusinessAccount" a ON a.id=p."accountId" JOIN "BusinessJournal" j ON j.id=p."journalId" WHERE a.code='WIP' AND j."actorId"='cafe-demo-v1-actor-1'),0) AS ok`,
    )
  )[0];
  eq(wip.ok, true, "Open kitchen costs must match WIP");
  eq(
    (
      await rows(
        `SELECT COUNT(*)::int AS n FROM "BusinessSaleLine" s JOIN "Order" o ON o.id=s."orderId" WHERE o.id LIKE 'cafe-demo-v1-order-%' AND s.date<>(o."placedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Karachi')::date`,
      )
    )[0].n,
    0,
    "Historical demo sales must match order dates",
  );
  eq(
    (
      await rows(
        `SELECT COUNT(*)::int AS n FROM "BusinessJournal" j JOIN "Order" o ON o.id=j."orderId" WHERE o.id LIKE 'cafe-demo-v1-order-%' AND j.date<>(o."placedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Karachi')::date`,
      )
    )[0].n,
    0,
  );
  eq(
    (
      await rows(
        `SELECT COUNT(*)::int AS n FROM "TableSession" s JOIN "Order" o ON o."tableSessionId"=s.id WHERE s.id LIKE 'cafe-demo-v1-session-%' AND s."closedAt" IS NOT NULL AND (o.status NOT IN ('DELIVERED','CANCELLED') OR (o.status<>'CANCELLED' AND o."amountPaid"-o."amountRefunded"<o.total) OR (o.status='CANCELLED' AND o."amountPaid">o."amountRefunded"))`,
      )
    )[0].n,
    0,
    "Closed bills must be settled",
  );
  const statuses = await rows(
    `SELECT status::text AS status,COUNT(*)::int AS n FROM "Order" WHERE id LIKE 'cafe-demo-v1-order-%' GROUP BY status`,
  );
  for (const status of [
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ]) {
    assert.ok(
      statuses.some((s) => s.status === status && s.n > 0),
      status,
    );
    checks++;
  }
  const payroll = await rows(
    `SELECT p.status,COUNT(*)::int AS n FROM "PayrollRecord" p JOIN "Employee" e ON e.id=p."employeeId" WHERE e.code LIKE 'DEMO-%' GROUP BY p.status`,
  );
  if (summary.payrolls) {
    eq(payroll.find((p) => p.status === "POSTED").n, 10);
    eq(payroll.find((p) => p.status === "DRAFT").n, 2);
  }
  eq(
    (
      await rows(
        `SELECT COUNT(*)::int AS n FROM "BusinessJournal" WHERE "actorId"='cafe-demo-v1-actor-1' AND note NOT LIKE 'DEMO · %'`,
      )
    )[0].n,
    0,
  );
  console.log(
    `PASS: ${checks} demo-data checks; ${summary.orders} orders, ${summary.attendance} attendance records, dated financial activity, private training menu and balanced stock/ledger.`,
  );
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());

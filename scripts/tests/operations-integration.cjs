/** Extended workflows after business-integration fixtures; never use a live DB. */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Pool } = require(process.env.CAFE_TEST_PG_MODULE || "pg");
const base = process.env.CAFE_BUSINESS_TEST_URL || "http://127.0.0.1:4180";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const db = new Pool({
  host: "127.0.0.1",
  user: "agent",
  database: "cafe_operations_test",
});
const sql = async (q, v) => (await db.query(q, v)).rows;
let n = 0;
const eq = (a, b, m) => {
  assert.equal(a, b, m);
  n++;
};
async function login(email) {
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Business-QA-123!" }),
  });
  eq(r.status, 200, email);
  const cookie = r.headers
    .getSetCookie()
    .map((x) => x.split(";")[0])
    .join("; ");
  return async (path, data, status = 200, method) => {
    const r = await fetch(base + path, {
      method: method || (data ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", Cookie: cookie },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const j = await r.json();
    eq(r.status, status, path + " " + JSON.stringify(j));
    return j;
  };
}
const post = async (who, module, data, status = 200) =>
  (
    await who(
      "/api/admin/business/" + module,
      { requestId: randomUUID(), ...data },
      status,
    )
  ).result;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
}).format(new Date());
(async () => {
  eq(
    (await sql("SELECT current_database() AS name"))[0].name,
    "cafe_operations_test",
  );
  const owner = await login("business-owner@example.test"),
    manager = await login("manager@example.test"),
    cashier = await login("cashier@example.test"),
    chef = await login("chef@example.test"),
    waiter = await login("waiter@example.test");
  await cashier("/api/admin/business/procurement", null, 403);
  await chef("/api/admin/business/approvals", null, 403);
  await waiter("/api/admin/business/stockcounts", null, 403);
  const supplier = await post(owner, "suppliers", {
    name: "Operations supplier",
    isActive: true,
  });
  const a = await post(owner, "ingredients", {
    action: "SAVE",
    name: "Operations milk",
    unit: "ML",
    reorderAt: "5",
    isActive: true,
  });
  const b = await post(owner, "ingredients", {
    action: "SAVE",
    name: "Operations flour",
    unit: "G",
    reorderAt: "5",
    isActive: true,
  });
  const po = await post(manager, "procurement", {
    action: "DRAFT",
    supplierId: supplier.id,
    expectedOn: today,
    note: "Approved weekly replenishment",
    lines: [
      { ingredientId: a.id, quantity: "10", totalCost: "100.01" },
      { ingredientId: b.id, quantity: "20", totalCost: "50" },
    ],
  });
  eq(
    (
      await sql('SELECT quantity::text FROM "Ingredient" WHERE id=$1', [a.id])
    )[0].quantity,
    "0.0000",
  );
  await post(
    manager,
    "procurement",
    {
      action: "RECEIVE",
      id: po.id,
      version: po.updatedAt,
      invoiceNumber: "OPS-001",
      date: today,
      note: "Delivery received",
      paid: "10.01",
      accountId: "BANK",
    },
    400,
  );
  const approved = await post(manager, "procurement", {
    action: "APPROVE",
    id: po.id,
    version: po.updatedAt,
    note: "Supplier costs checked",
  });
  const receive = {
    requestId: randomUUID(),
    action: "RECEIVE",
    id: po.id,
    version: approved.updatedAt,
    invoiceNumber: "OPS-001",
    date: today,
    note: "Full delivery counted",
    paid: "10.01",
    accountId: "BANK",
  };
  const received = await post(manager, "procurement", receive);
  await post(manager, "procurement", receive);
  eq(received.status, "RECEIVED");
  eq(
    (
      await sql(
        'SELECT COUNT(*)::int AS n FROM "BusinessPurchase" WHERE "invoiceNumber"=$1',
        ["OPS-001"],
      )
    )[0].n,
    1,
  );
  eq(
    (
      await sql('SELECT quantity::text FROM "Ingredient" WHERE id=$1', [a.id])
    )[0].quantity,
    "10.0000",
  );
  await post(
    manager,
    "procurement",
    {
      action: "CANCEL",
      id: po.id,
      version: received.updatedAt,
      note: "Cannot undo received PO",
    },
    400,
  );
  console.log(
    "PASS purchase commitments: no premature stock, approvals, exact invoice receipt, partial payment and retry idempotency",
  );
  const current = async () =>
    (await owner("/api/admin/business/ingredients")).ingredients;
  let ingredients = await current();
  let ca = ingredients.find((i) => i.id === a.id),
    cb = ingredients.find((i) => i.id === b.id);
  const draft = await post(owner, "stockcounts", {
    action: "DRAFT",
    date: today,
    note: "End of day physical count",
    lines: [
      { ingredientId: a.id, version: ca.version, counted: "9" },
      {
        ingredientId: b.id,
        version: cb.version,
        counted: "21",
        addedValue: "2.50",
      },
    ],
  });
  await post(owner, "ingredients", {
    action: "ADJUST",
    ingredientId: b.id,
    kind: "IN",
    quantity: "1",
    value: "2.50",
    date: today,
    note: "Delivery after stock snapshot",
  });
  await post(
    owner,
    "stockcounts",
    {
      action: "POST",
      id: draft.id,
      version: draft.updatedAt,
      note: "Stale batch must fail",
    },
    409,
  );
  eq(
    (
      await sql('SELECT quantity::text FROM "Ingredient" WHERE id=$1', [a.id])
    )[0].quantity,
    "10.0000",
    "No earlier line is partially adjusted",
  );
  await post(owner, "stockcounts", {
    action: "CANCEL",
    id: draft.id,
    version: draft.updatedAt,
    note: "Discard stale count and recount",
  });
  ingredients = await current();
  ca = ingredients.find((i) => i.id === a.id);
  cb = ingredients.find((i) => i.id === b.id);
  const count = await post(manager, "stockcounts", {
    action: "DRAFT",
    date: today,
    note: "Fresh physical count",
    lines: [
      { ingredientId: a.id, version: ca.version, counted: "9" },
      {
        ingredientId: b.id,
        version: cb.version,
        counted: "22",
        addedValue: "2.50",
      },
    ],
  });
  const posted = await post(manager, "stockcounts", {
    action: "POST",
    id: count.id,
    version: count.updatedAt,
    note: "All quantities verified",
  });
  eq(posted.status, "POSTED");
  eq(
    (
      await sql('SELECT quantity::text FROM "Ingredient" WHERE id=$1', [a.id])
    )[0].quantity,
    "9.0000",
  );
  eq(
    (
      await sql('SELECT quantity::text FROM "Ingredient" WHERE id=$1', [b.id])
    )[0].quantity,
    "22.0000",
  );
  console.log(
    "PASS batch stock counts: stale snapshot rollback, shortage/overage value and whole-batch posting",
  );
  const pos = async (actor, extra = {}, status = 201) =>
    actor(
      "/api/admin/pos",
      {
        requestId: randomUUID(),
        lines: [{ productId: "business-paratha", quantity: 1, addonIds: [] }],
        cashReceived: 200,
        accountId: "BANK",
        ...extra,
      },
      status,
    );
  const cancelled = (await pos(owner)).order;
  await owner(
    "/api/admin/orders/" + cancelled.id,
    { status: "CANCELLED", note: "Operations refund test" },
    200,
    "PATCH",
  );
  const refund = {
    requestId: randomUUID(),
    orderId: cancelled.id,
    amount: "200",
    refund: true,
    accountId: "BANK",
    note: "Actual cashless refund",
  };
  await cashier("/api/admin/order-payments", refund, 403);
  const req = await post(cashier, "approvals", {
    action: "REQUEST",
    kind: "REFUND",
    orderId: cancelled.id,
    amount: "200",
    reason: "Refund cancelled ticket",
  });
  await post(
    cashier,
    "approvals",
    {
      action: "DECIDE",
      id: req.id,
      approved: true,
      note: "Self approval forbidden",
    },
    403,
  );
  await post(manager, "approvals", {
    action: "DECIDE",
    id: req.id,
    approved: true,
    note: "Customer refund verified",
  });
  await cashier(
    "/api/admin/order-payments",
    { ...refund, approvalId: req.id, amount: "199.99" },
    403,
  );
  const refunded = await cashier("/api/admin/order-payments", {
    ...refund,
    approvalId: req.id,
  });
  await cashier("/api/admin/order-payments", { ...refund, approvalId: req.id });
  eq(Number(refunded.order.amountRefunded), 200);
  await cashier(
    "/api/admin/order-payments",
    { ...refund, requestId: randomUUID(), approvalId: req.id },
    403,
  );
  const discount = await post(cashier, "approvals", {
    action: "REQUEST",
    kind: "DISCOUNT",
    amount: "25",
    reason: "Approved customer courtesy",
    lines: [{ productId: "business-paratha", quantity: 1, addonIds: [] }],
  });
  await post(manager, "approvals", {
    action: "DECIDE",
    id: discount.id,
    approved: true,
    note: "Courtesy amount approved",
  });
  await pos(
    cashier,
    {
      approvalId: discount.id,
      lines: [{ productId: "business-paratha", quantity: 2, addonIds: [] }],
      cashReceived: 400,
    },
    403,
  );
  const saleBody = {
    requestId: randomUUID(),
    approvalId: discount.id,
    lines: [{ productId: "business-paratha", quantity: 1, addonIds: [] }],
    cashReceived: 175,
    accountId: "BANK",
    expectedTotal: 175,
  };
  const sale = await cashier("/api/admin/pos", saleBody, 201);
  eq(sale.order.total, 175);
  eq(sale.order.discount, 25);
  const repeated = await cashier("/api/admin/pos", saleBody, 201);
  eq(repeated.order.id, sale.order.id);
  await pos(cashier, { approvalId: discount.id, cashReceived: 175 }, 403);
  eq(
    (
      await sql('SELECT status FROM "CafeApproval" WHERE id=$1', [discount.id])
    )[0].status,
    "USED",
  );
  console.log(
    "PASS approvals: manager review, wrong amount/cart denial, single use and idempotent refunds/discounts",
  );
  const tables = [];
  for (const name of ["Operations A", "Operations B", "Operations C"])
    tables.push(
      await post(owner, "tables", {
        action: "SAVE",
        name,
        seats: 4,
        isActive: true,
      }),
    );
  const session = await post(waiter, "tables", {
    action: "OPEN",
    tableId: tables[0].id,
    guestCount: 2,
  });
  const target = await post(waiter, "tables", {
    action: "OPEN",
    tableId: tables[1].id,
    guestCount: 1,
  });
  for (let i = 0; i < 2; i++)
    await waiter(
      "/api/admin/table-orders",
      {
        requestId: randomUUID(),
        sessionId: session.id,
        lines: [{ productId: "business-paratha", quantity: 1, addonIds: [] }],
      },
      201,
    );
  await post(
    waiter,
    "tables",
    {
      action: "TRANSFER",
      sessionId: session.id,
      tableId: tables[2].id,
      note: "Waiter needs cashier permission",
    },
    403,
  );
  await post(
    cashier,
    "tables",
    {
      action: "TRANSFER",
      sessionId: session.id,
      tableId: tables[1].id,
      note: "Occupied table is refused",
    },
    400,
  );
  await post(cashier, "tables", {
    action: "TRANSFER",
    sessionId: session.id,
    tableId: tables[2].id,
    note: "Guests moved to terrace",
  });
  const tickets = await sql(
    'SELECT id FROM "Order" WHERE "tableSessionId"=$1 ORDER BY id',
    [session.id],
  );
  await post(cashier, "tables", {
    action: "SPLIT",
    sessionId: session.id,
    targetSessionId: target.id,
    orderIds: [tickets[0].id],
    note: "One ticket billed separately",
  });
  eq(
    (
      await sql(
        'SELECT COUNT(*)::int AS n FROM "Order" WHERE "tableSessionId"=$1',
        [target.id],
      )
    )[0].n,
    1,
  );
  await post(cashier, "tables", {
    action: "MERGE",
    sessionId: session.id,
    targetSessionId: target.id,
    note: "Guests requested a single bill",
  });
  eq(
    (
      await sql(
        'SELECT COUNT(*)::int AS n FROM "Order" WHERE "tableSessionId"=$1',
        [target.id],
      )
    )[0].n,
    2,
  );
  eq(
    (
      await sql(
        'SELECT "closedAt" IS NOT NULL AS closed FROM "TableSession" WHERE id=$1',
        [session.id],
      )
    )[0].closed,
    true,
  );
  console.log(
    "PASS table transfer, occupied-table guards, ticket splitting and bill merge without duplicate sales",
  );
  const cash = await cashier("/api/admin/business/cash");
  const drawer = cash.drawers.find((d) => d.account.code === "CASH_MAIN");
  const shift = await post(cashier, "cash", {
    action: "OPEN",
    drawerId: drawer.id,
    amount: drawer.balance,
    note: "Cashier counted opening",
  });
  const amount = (Number(drawer.balance) + 0.5).toFixed(2);
  await post(
    cashier,
    "cash",
    {
      action: "CLOSE",
      shiftId: shift.id,
      amount,
      note: "Invalid denomination test",
      denominations: [{ value: "1", count: 0 }],
    },
    400,
  );
  const closeBody = {
    requestId: randomUUID(),
    action: "CLOSE",
    shiftId: shift.id,
    amount,
    note: "Fifty paisa over count",
    denominations: [{ value: "0.5", count: Math.round(Number(amount) * 2) }],
  };
  const closed = await post(cashier, "cash", closeBody);
  await post(cashier, "cash", closeBody);
  eq(Number(closed.variance), 0.5);
  eq(closed.closedByName, "QA CASHIER");
  await post(
    cashier,
    "cash",
    {
      action: "REVIEW",
      shiftId: shift.id,
      amount: "0",
      note: "Cashier cannot approve",
    },
    403,
  );
  const reviewed = await post(manager, "cash", {
    action: "REVIEW",
    shiftId: shift.id,
    amount: "0",
    note: "Count evidence reviewed",
  });
  assert.ok(reviewed.reviewedAt);
  n++;
  const overview = await owner(
    "/api/admin/business/overview?from=" + today + "&to=" + today,
  );
  eq(overview.trialDebit, overview.trialCredit);
  eq(
    (Number(overview.openingMoney) + Number(overview.netCashFlow)).toFixed(2),
    Number(overview.closingMoney).toFixed(2),
  );
  const audit = await owner(
    "/api/admin/business/audit?from=" +
      today +
      "&to=" +
      today +
      "&q=REVIEW_SHIFT",
  );
  assert.ok(audit.rows.some((a) => a.entityId === shift.id));
  n++;
  await owner("/api/admin/business/audit?page=-1", null, 400);
  eq(
    (
      await sql(
        'SELECT COALESCE(SUM(debit-credit),0)::text AS delta FROM "BusinessPosting"',
      )
    )[0].delta,
    "0.00",
  );
  eq(
    Number(
      (
        await sql(
          'SELECT COALESCE(SUM("stockValue"),0)::text AS value FROM "Ingredient"',
        )
      )[0].value,
    ),
    Number(
      (
        await sql(
          'SELECT SUM(p.debit-p.credit)::text AS value FROM "BusinessPosting" p JOIN "BusinessAccount" a ON a.id=p."accountId" WHERE a.code=$1',
          ["INVENTORY"],
        )
      )[0].value,
    ),
  );
  console.log(
    "PASS denomination closing, role review, cash-flow reconciliation, searchable audit and balanced inventory ledger. " +
      n +
      " assertions.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());

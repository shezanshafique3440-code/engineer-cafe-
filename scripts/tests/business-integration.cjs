/** Real HTTP + Postgres accounting regression. Only runs on a disposable local DB.
 * Seed the isolated fixture described in docs/cafe-business.md before running.
 * Never point this script at the live cafe database.
 */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Pool } = require(process.env.CAFE_TEST_PG_MODULE || "pg");
const url = process.env.CAFE_BUSINESS_TEST_URL || "http://localhost:4175";
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw Error("Local test server required");
const database = process.env.CAFE_TEST_DATABASE || "cafe_business_test";
assert.ok(
  ["cafe_business_test", "cafe_operations_test"].includes(database),
  "Disposable test database required.",
);
const db = new Pool({
  host: "127.0.0.1",
  user: "agent",
  database,
});
let assertions = 0;
const eq = (a, b, n) => {
  assert.equal(a, b, n);
  assertions++;
};
const sql = async (q, v) => (await db.query(q, v)).rows;
const balance = async (code, party) =>
  Number(
    (
      await sql(
        'SELECT COALESCE(SUM(p.debit-p.credit),0)::text AS value FROM "BusinessPosting" p JOIN "BusinessAccount" a ON a.id=p."accountId" WHERE a.code=$1 AND ($2::text IS NULL OR p."partyId"=$2)',
        [code, party ?? null],
      )
    )[0].value,
  );
let ip = 20;
async function login(email) {
  let cookie = "";
  const headers = {
    "Content-Type": "application/json",
    "x-real-ip": `192.0.2.${ip++}`,
  };
  const res = await fetch(url + "/api/auth/login", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password: "Business-QA-123!" }),
  });
  const j = await res.json();
  eq(res.status, 200, JSON.stringify(j));
  cookie = res.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  return async (path, body, status = 200, method) => {
    const r = await fetch(url + path, {
      method: method || (body ? "POST" : "GET"),
      headers: { ...headers, Cookie: cookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const j = await r.json();
    assert.equal(r.status, status, `${path}: ${JSON.stringify(j)}`);
    assertions++;
    return j;
  };
}
const post = (a, m, body, status = 200) =>
  a(
    "/api/admin/business/" + m,
    { requestId: randomUUID(), ...body },
    status,
  ).then((r) => r.result ?? r);
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const dated = { date: today, note: "Isolated regression check" };
(async () => {
  eq(
    (await sql("SELECT current_database()::text AS name"))[0].name,
    database,
  );
  eq(
    (await sql('SELECT count(*)::int AS n FROM "BusinessJournal"'))[0].n,
    0,
    "Use a fresh disposable database for each run",
  );
  const owner = await login("business-owner@example.test");
  await owner("/api/admin/business/setup");
  await post(
    owner,
    "setup",
    {
      action: "CONFIG",
      enabled: true,
      note: "Check activation requires recipes",
    },
    400,
  );
  const ing = {};
  for (const [name, unit, qty, value] of [
    ["Milk", "ML", "10000", "2000"],
    ["Tea", "G", "1000", "1000"],
    ["Flour", "G", "10000", "800"],
    ["Potato", "G", "5000", "500"],
  ]) {
    const i = await post(owner, "ingredients", {
      action: "SAVE",
      name,
      unit,
      reorderAt: "100",
      isActive: true,
    });
    ing[name] = i.id;
    await post(owner, "ingredients", {
      action: "ADJUST",
      ingredientId: i.id,
      kind: "OPENING",
      quantity: qty,
      value,
      ...dated,
    });
  }
  const recipe = await post(owner, "recipes", {
    productId: "business-chai",
    required: true,
    yieldUnits: "1",
    lines: [
      { ingredientId: ing.Milk, quantity: "200" },
      { ingredientId: ing.Tea, quantity: "10" },
    ],
  });
  await post(owner, "recipes", {
    productId: "business-paratha",
    required: true,
    yieldUnits: "1",
    lines: [
      { ingredientId: ing.Flour, quantity: "100" },
      { ingredientId: ing.Potato, quantity: "50" },
    ],
  });
  for (const [code, amount] of [
    ["CASH_MAIN", "5000"],
    ["BANK", "10000"],
  ])
    await post(owner, "money", {
      kind: "OPENING",
      amount,
      accountId: code,
      ...dated,
    });
  const ctx = await owner("/api/admin/sales-context");
  const drawer = (await sql('SELECT id FROM "CashDrawer"'))[0].id;
  const shift = await post(owner, "cash", {
    action: "OPEN",
    drawerId: drawer,
    amount: "5000",
    note: "Opening verified",
  });
  const staff = {};
  for (const profile of ["WAITER", "CHEF", "CASHIER", "MANAGER"]) {
    const e = await post(owner, "staff", {
      code: profile,
      name: "QA " + profile,
      designation: profile,
      payBasis: "MONTHLY",
      basePay: "3000",
      overtimeRate: "100",
      joinedOn: "2026-10-01",
      isActive: true,
      login: {
        email: profile.toLowerCase() + "@example.test",
        password: "Business-QA-123!",
        profile,
      },
    });
    staff[profile] = e;
  }
  const waiter = await login("waiter@example.test"),
    chef = await login("chef@example.test"),
    cashier = await login("cashier@example.test"),
    manager = await login("manager@example.test");
  for (const actor of [waiter, chef, cashier, manager]) {
    await actor("/api/admin/business/payroll", null, 403);
    await actor("/api/admin/business/ledger", null, 403);
  }
  await post(owner, "opening", {
    partyId: staff.CHEF.partyId,
    kind: "SALARY_DUE",
    amount: "50",
    ...dated,
  });
  const chefStock = await chef("/api/admin/business/ingredients");
  eq(
    chefStock.ingredients.some((i) => "stockValue" in i),
    false,
    "Chef must not receive ingredient costs",
  );
  await post(owner, "setup", {
    action: "CONFIG",
    enabled: true,
    note: "Recipes and opening records reviewed",
  });
  const pos = async (q = 2, extra = {}, status = 201) =>
    owner(
      "/api/admin/pos",
      {
        requestId: randomUUID(),
        lines: [{ productId: "business-chai", quantity: q, addonIds: [] }],
        cashReceived: q * 150,
        ...extra,
      },
      status,
    );
  let o = (await pos(2, { cashReceived: 500.5 })).order;
  eq(o.total, 300);
  eq(o.cashChange, 200.5);
  eq(o.amountPaid, "300");
  eq(await balance("CASH_MAIN"), 5300);
  eq(await balance("FOOD_SALES"), 0);
  eq(
    (
      await sql('SELECT quantity::text FROM "Ingredient" WHERE id=$1', [
        ing.Milk,
      ])
    )[0].quantity,
    "10000.0000",
  );
  const status = async (actor, id, value, want = 200) =>
    actor(
      "/api/admin/orders/" + id,
      { status: value, note: "Regression lifecycle" },
      want,
      "PATCH",
    );
  await status(chef, o.id, "PREPARING");
  eq(await balance("WIP"), 100);
  eq(
    (
      await sql('SELECT quantity::text FROM "Ingredient" WHERE id=$1', [
        ing.Milk,
      ])
    )[0].quantity,
    "9600.0000",
  );
  await status(chef, o.id, "READY");
  await status(chef, o.id, "DELIVERED", 403);
  await status(owner, o.id, "DELIVERED");
  eq(await balance("FOOD_SALES"), -300);
  eq(await balance("COGS"), 100);
  eq(await balance("WIP"), 0);
  await status(owner, o.id, "CANCELLED");
  eq(await balance("FOOD_SALES"), 0);
  eq(await balance("COGS"), 0);
  eq(await balance("WASTE"), 100);
  eq(await balance("WIP"), 0);
  eq(await balance("CASH_MAIN"), 5300);
  const refund = {
    requestId: randomUUID(),
    orderId: o.id,
    refund: true,
    amount: "200",
    accountId: "CASH_MAIN",
    note: "Actual customer refund",
  };
  await owner("/api/admin/order-payments", refund);
  await owner("/api/admin/order-payments", refund);
  eq(await balance("CASH_MAIN"), 5100);
  await owner("/api/admin/order-payments", { ...refund, amount: "100" }, 409);
  await owner("/api/admin/order-payments", {
    ...refund,
    requestId: randomUUID(),
    amount: "100",
  });
  eq(await balance("CASH_MAIN"), 5000);
  eq(
    (await sql('SELECT "paymentStatus" FROM "Order" WHERE id=$1', [o.id]))[0]
      .paymentStatus,
    "REFUNDED",
  );
  await owner(
    "/api/admin/orders/" + o.id,
    {
      orderNumber: o.orderNumber,
      version: (await owner("/api/admin/orders/" + o.id)).order.version,
    },
    409,
    "DELETE",
  );
  console.log(
    "PASS orders: reservation, preparation, revenue, exact change, cooked cancellation and actual idempotent refunds",
  );
  // Reserved recipes remain fixed even after the administrator changes future recipes.
  const reserved = (await pos(1)).order;
  await post(
    owner,
    "ingredients",
    {
      action: "ADJUST",
      ingredientId: ing.Milk,
      kind: "OUT",
      quantity: "9600",
      ...dated,
    },
    400,
  );
  await post(owner, "recipes", {
    productId: "business-chai",
    version: recipe.updatedAt,
    required: true,
    yieldUnits: "1",
    lines: [
      { ingredientId: ing.Milk, quantity: "300" },
      { ingredientId: ing.Tea, quantity: "10" },
    ],
  });
  await status(chef, reserved.id, "PREPARING");
  eq(
    (
      await sql('SELECT quantity::text FROM "Ingredient" WHERE id=$1', [
        ing.Milk,
      ])
    )[0].quantity,
    "9400.0000",
  );
  await status(owner, reserved.id, "CANCELLED");
  await owner("/api/admin/order-payments", {
    requestId: randomUUID(),
    orderId: reserved.id,
    refund: true,
    amount: "150",
    accountId: "CASH_MAIN",
    note: "Refund cancelled ticket",
  });
  const supplier = await post(owner, "suppliers", {
    name: "QA Dairy",
    isActive: true,
  });
  const purchase = await post(owner, "purchases", {
    action: "POST",
    supplierId: supplier.id,
    invoiceNumber: "QA-001",
    date: today,
    note: "Fresh milk",
    lines: [{ ingredientId: ing.Milk, quantity: "10000", totalCost: "2500" }],
    paid: "1000",
    accountId: "CASH_MAIN",
  });
  eq(await balance("SUPPLIER_CONTROL", supplier.id), -1500);
  const returned = await post(owner, "purchases", {
    action: "RETURN",
    lineId: purchase.lines[0].id,
    quantity: "1000",
    ...dated,
  });
  eq(Number(returned.value), 250);
  eq(await balance("SUPPLIER_CONTROL", supplier.id), -1250);
  await post(owner, "payments", {
    kind: "SUPPLIER_PAYMENT",
    partyId: supplier.id,
    amount: "1500",
    accountId: "CASH_MAIN",
    ...dated,
  });
  eq(await balance("SUPPLIER_CONTROL", supplier.id), 250);
  await post(owner, "payments", {
    kind: "SUPPLIER_REFUND",
    partyId: supplier.id,
    amount: "250",
    accountId: "CASH_MAIN",
    ...dated,
  });
  eq(await balance("SUPPLIER_CONTROL", supplier.id), 0);
  eq(await balance("CASH_MAIN"), 2750);
  console.log(
    "PASS purchases: weighted cost, invoice returns, supplier advances and supplier refunds",
  );
  const emp = staff.WAITER;
  await post(owner, "payments", {
    kind: "STAFF_ADVANCE",
    partyId: emp.partyId,
    amount: "600",
    accountId: "CASH_MAIN",
    ...dated,
  });
  await post(owner, "payments", {
    kind: "STAFF_REPAYMENT",
    partyId: emp.partyId,
    amount: "100",
    accountId: "CASH_MAIN",
    ...dated,
  });
  await post(owner, "attendance", {
    employeeId: emp.id,
    date: "2026-10-01",
    status: "ABSENT",
    overtimeHours: "0",
  });
  const attendance = await post(owner, "attendance", {
    employeeId: emp.id,
    date: "2026-10-02",
    status: "PRESENT",
    overtimeHours: "1",
    clockIn: "2026-10-02T04:00:00Z",
    clockOut: "2026-10-02T13:00:00Z",
  });
  const draftBody = {
    action: "DRAFT",
    employeeId: emp.id,
    start: "2026-10-01",
    end: "2026-10-31",
    bonus: "100",
    deduction: "20",
    recoverAdvance: true,
    note: "October approved payroll",
  };
  const stale = await post(owner, "payroll", draftBody);
  await post(owner, "attendance", {
    employeeId: emp.id,
    date: "2026-10-02",
    version: attendance.updatedAt,
    status: "PRESENT",
    overtimeHours: "2",
  });
  await post(
    owner,
    "payroll",
    {
      action: "POST",
      id: stale.id,
      version: stale.updatedAt,
      acknowledgeAttendance: true,
    },
    409,
  );
  const pay = await post(owner, "payroll", draftBody);
  eq(Number(pay.unpaidDeduction), 96.77);
  eq(Number(pay.overtimePay), 200);
  eq(Number(pay.earnedPay), 3183.23);
  eq(Number(pay.netPay), 2683.23);
  await post(
    owner,
    "payroll",
    {
      action: "POST",
      id: pay.id,
      version: pay.updatedAt,
      acknowledgeAttendance: false,
    },
    400,
  );
  await post(owner, "payroll", {
    action: "POST",
    id: pay.id,
    version: pay.updatedAt,
    acknowledgeAttendance: true,
  });
  eq(await balance("STAFF_ADVANCES", emp.partyId), 0);
  eq(await balance("SALARIES_PAYABLE", emp.partyId), -2683.23);
  await post(owner, "payroll", draftBody, 400);
  const paidPayroll = {
    requestId: randomUUID(),
    kind: "PAYROLL_PAYMENT",
    partyId: emp.partyId,
    payrollId: pay.id,
    amount: "2683.23",
    accountId: "BANK",
    ...dated,
  };
  await post(owner, "payments", paidPayroll);
  await post(owner, "payments", paidPayroll);
  eq(await balance("SALARIES_PAYABLE", emp.partyId), 0);
  await post(
    owner,
    "payroll",
    { action: "REVERSE", id: pay.id, note: "Paid payroll cannot reverse" },
    400,
  );
  console.log(
    "PASS payroll: attendance, overtime, paise, advances, stale/overlapping period guards and payment idempotency",
  );
  await post(owner, "payments", {
    kind: "SALARY_BALANCE_PAYMENT",
    partyId: staff.CHEF.partyId,
    amount: "50",
    accountId: "BANK",
    ...dated,
  });
  eq(await balance("SALARIES_PAYABLE", staff.CHEF.partyId), 0);
  await post(
    owner,
    "payments",
    {
      kind: "SALARY_BALANCE_PAYMENT",
      partyId: staff.CHEF.partyId,
      amount: "1",
      accountId: "BANK",
      ...dated,
    },
    400,
  );
  await post(owner, "payments", {
    kind: "STAFF_ADVANCE",
    partyId: staff.CHEF.partyId,
    amount: "200",
    accountId: "BANK",
    ...dated,
  });
  const reversing = await post(owner, "payroll", {
    action: "DRAFT",
    employeeId: staff.CHEF.id,
    start: "2026-10-01",
    end: "2026-10-31",
    bonus: "0",
    deduction: "0",
    recoverAdvance: true,
    note: "Unpaid payroll reversal test",
  });
  await post(owner, "payroll", {
    action: "POST",
    id: reversing.id,
    version: reversing.updatedAt,
    acknowledgeAttendance: true,
  });
  await post(
    owner,
    "payments",
    {
      kind: "SALARY_BALANCE_PAYMENT",
      partyId: staff.CHEF.partyId,
      amount: "1",
      accountId: "BANK",
      ...dated,
    },
    400,
  );
  await post(owner, "payroll", {
    action: "REVERSE",
    id: reversing.id,
    note: "Reverse unpaid payroll and recovery",
  });
  eq(await balance("STAFF_ADVANCES", staff.CHEF.partyId), 200);
  eq(await balance("SALARIES_PAYABLE", staff.CHEF.partyId), 0);
  await post(owner, "payments", {
    kind: "STAFF_REPAYMENT",
    partyId: staff.CHEF.partyId,
    amount: "200",
    accountId: "BANK",
    ...dated,
  });
  const managerMoney = await manager("/api/admin/business/money");
  eq(
    managerMoney.journals.some(
      (j) => j.reversalOfId && j.sourceId === reversing.id,
    ),
    false,
  );
  eq(
    managerMoney.journals.some(
      (j) => j.note === "Reverse unpaid payroll and recovery",
    ),
    false,
    "Expense views must not expose payroll reversal details",
  );
  await post(
    manager,
    "payments",
    {
      kind: "SUPPLIER_PAYMENT",
      partyId: supplier.id,
      amount: "1",
      accountId: "BANK",
      payrollId: pay.id,
      ...dated,
    },
    400,
  );
  const table = await post(owner, "tables", {
    action: "SAVE",
    name: "Garden 1",
    seats: 4,
    isActive: true,
  });
  const bill = await post(waiter, "tables", {
    action: "OPEN",
    tableId: table.id,
    guestCount: 2,
  });
  await post(
    waiter,
    "tables",
    { action: "OPEN", tableId: table.id, guestCount: 1 },
    400,
  );
  const waiterTables = await waiter("/api/admin/business/tables");
  const assigned = waiterTables.tables.find((t) => t.id === table.id)
    .sessions[0];
  eq(
    "basePay" in assigned.waiter,
    false,
    "Waiter table summaries must not leak employee salaries",
  );
  await waiter("/api/admin/orders/" + o.id, null, 404);
  const ticket = (
    await waiter(
      "/api/admin/table-orders",
      {
        requestId: randomUUID(),
        sessionId: bill.id,
        lines: [{ productId: "business-paratha", quantity: 2, addonIds: [] }],
        customerName: "Table guest",
      },
      201,
    )
  ).order;
  eq(ticket.cashierName, null, "An unpaid waiter ticket must not attribute sales to the waiter as cashier");
  eq(Number(ticket.amountPaid), 0);
  eq(ticket.businessCredit, true);
  await post(owner, "tables", { action: "CLOSE", sessionId: bill.id }, 400);
  await status(chef, ticket.id, "PREPARING");
  await status(chef, ticket.id, "READY");
  await status(waiter, ticket.id, "DELIVERED");
  eq(await balance("FOOD_SALES"), -400);
  eq(
    (await owner("/api/admin/orders/" + ticket.id)).order.paymentStatus,
    "UNPAID",
  );
  await post(
    waiter,
    "tables",
    {
      action: "PAY",
      sessionId: bill.id,
      amount: "400",
      accountId: "BANK",
      note: "Role cannot take payments",
    },
    403,
  );
  await post(owner, "tables", {
    action: "PAY",
    sessionId: bill.id,
    amount: "100.25",
    accountId: "BANK",
    note: "Partial table settlement",
  });
  await post(owner, "tables", { action: "CLOSE", sessionId: bill.id }, 400);
  await post(owner, "tables", {
    action: "PAY",
    sessionId: bill.id,
    amount: "299.75",
    accountId: "BANK",
    note: "Remaining table settlement",
  });
  await post(owner, "tables", { action: "CLOSE", sessionId: bill.id });
  eq((await sql('SELECT "cashierId" FROM "Order" WHERE id=$1', [ticket.id]))[0].cashierId, "business-owner", "Table collection records the actual cashier");
  console.log(
    "PASS tables: waiter assignment, kitchen tickets, served credit bills, split settlement and close guards",
  );
  const customer = await post(owner, "customers", {
    name: "Approved customer",
    isActive: true,
    creditLimit: "500",
  });
  const credit = (
    await pos(2, { credit: true, partyId: customer.id, cashReceived: 0 })
  ).order;
  await pos(2, { credit: true, partyId: customer.id, cashReceived: 0 }, 400);
  await status(owner, credit.id, "DELIVERED");
  eq(await balance("CUSTOMER_CONTROL", customer.id), 300);
  await post(owner, "payments", {
    kind: "CUSTOMER_RECEIPT",
    partyId: customer.id,
    amount: "299.99",
    accountId: "BANK",
    ...dated,
  });
  eq(
    (await owner("/api/admin/orders/" + credit.id)).order.paymentStatus,
    "UNPAID",
  );
  await post(owner, "payments", {
    kind: "CUSTOMER_RECEIPT",
    partyId: customer.id,
    amount: "0.01",
    accountId: "BANK",
    ...dated,
  });
  eq(
    (await owner("/api/admin/orders/" + credit.id)).order.paymentStatus,
    "PAID",
  );
  eq(await balance("CUSTOMER_CONTROL", customer.id), 0);
  const partial = (
    await pos(2, {
      credit: true,
      partyId: customer.id,
      cashReceived: 100,
      accountId: "BANK",
    })
  ).order;
  eq(partial.customerName, "Approved customer");
  await pos(
    2,
    {
      lines: [{ productId: "business-paratha", quantity: 2, addonIds: [] }],
      credit: true,
      partyId: customer.id,
      cashReceived: 0,
    },
    400,
  );
  await status(owner, partial.id, "CANCELLED");
  await owner("/api/admin/order-payments", {
    requestId: randomUUID(),
    orderId: partial.id,
    refund: true,
    amount: "100",
    accountId: "BANK",
    note: "Refund cancelled partial deposit",
  });
  await pos(1, { partyId: supplier.id }, 400);
  // Two simultaneous orders compete for the last reservable ingredient.
  const scarce = await post(owner, "ingredients", {
    action: "SAVE",
    name: "Limited garnish",
    unit: "PCS",
    reorderAt: "0",
    isActive: true,
  });
  await post(owner, "ingredients", {
    action: "ADJUST",
    ingredientId: scarce.id,
    kind: "IN",
    quantity: "1",
    value: "1",
    ...dated,
  });
  await post(owner, "recipes", {
    productId: "business-service",
    required: true,
    yieldUnits: "1",
    lines: [{ ingredientId: scarce.id, quantity: "1" }],
  });
  const competing = await Promise.allSettled(
    [1, 2].map(() =>
      owner(
        "/api/admin/pos",
        {
          requestId: randomUUID(),
          lines: [{ productId: "business-service", quantity: 1, addonIds: [] }],
          cashReceived: 20,
          accountId: "BANK",
        },
        201,
      ),
    ),
  );
  eq(
    competing.filter((x) => x.status === "fulfilled").length,
    1,
    "Only one simultaneous order can reserve the last ingredient",
  );
  const winner = competing.find((x) => x.status === "fulfilled").value.order;
  eq(
    (
      await sql('SELECT quantity::text FROM "Ingredient" WHERE id=$1', [
        scarce.id,
      ])
    )[0].quantity,
    "1.0000",
  );
  const scarceNow = (
    await owner("/api/admin/business/ingredients")
  ).ingredients.find((i) => i.id === scarce.id);
  await post(
    owner,
    "ingredients",
    {
      action: "SAVE",
      id: scarce.id,
      version: scarceNow.version,
      name: scarce.name,
      unit: "PCS",
      reorderAt: "0",
      isActive: false,
    },
    400,
  );
  await status(owner, winner.id, "CANCELLED");
  await owner("/api/admin/order-payments", {
    requestId: randomUUID(),
    orderId: winner.id,
    refund: true,
    amount: "20",
    accountId: "BANK",
    note: "Uncooked cancellation refund",
  });
  eq(
    (
      await sql(
        'SELECT COUNT(*)::int AS n FROM "IngredientReservation" WHERE "ingredientId"=$1 AND "releasedAt" IS NULL AND "consumedAt" IS NULL',
        [scarce.id],
      )
    )[0].n,
    0,
  );
  console.log(
    "PASS concurrency: scarce ingredients cannot be oversold or archived while reserved; uncooked cancellation releases stock",
  );
  const cash = await balance("CASH_MAIN");
  const closed = await post(owner, "cash", {
    action: "CLOSE",
    shiftId: shift.id,
    amount: (cash + 0.5).toFixed(2),
    note: "Counted fifty paisa overage",
  });
  eq(Number(closed.variance), 0.5);
  const orderCount = (await sql('SELECT count(*)::int AS n FROM "Order"'))[0].n;
  await pos(1, {}, 400);
  eq(
    (await sql('SELECT count(*)::int AS n FROM "Order"'))[0].n,
    orderCount,
    "Failed cash sale must roll back order and reservation",
  );
  const totals = (
    await sql(
      'SELECT COALESCE(SUM(debit-credit),0)::text AS delta FROM "BusinessPosting"',
    )
  )[0];
  eq(Number(totals.delta), 0);
  const inventory = Number(
    (await sql('SELECT SUM("stockValue")::text AS value FROM "Ingredient"'))[0]
      .value,
  );
  eq(
    await balance("INVENTORY"),
    inventory,
    "Ingredient values must reconcile to the ledger",
  );
  eq(await balance("WIP"), 0);
  const journal = (await sql('SELECT id FROM "BusinessJournal" LIMIT 1'))[0].id;
  await assert.rejects(
    sql('UPDATE "BusinessJournal" SET note=$2 WHERE id=$1', [
      journal,
      "Tampered history",
    ]),
    /cannot be edited or deleted/i,
  );
  assertions++;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      'INSERT INTO "BusinessJournal" (id,"eventKey",source,"sourceId",date,"actorId","actorName",note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        randomUUID(),
        randomUUID(),
        "TEST",
        "TEST",
        today,
        "TEST",
        "TEST",
        "Invalid unbalanced entry",
      ],
    );
    await assert.rejects(client.query("COMMIT"), /balanced|balance/i);
    assertions++;
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  await owner("/api/admin/business/overview?from=2026-02-30", null, 400);
  await post(owner, "setup", {
    action: "CONFIG",
    lockedThrough: "2026-10-31",
    note: "Reviewed October books",
  });
  await post(
    owner,
    "money",
    {
      kind: "EXPENSE",
      amount: "1",
      expenseCode: "RENT",
      accountId: "BANK",
      date: "2026-10-30",
      note: "Closed period check",
    },
    400,
  );
  const overview = await owner("/api/admin/business/overview");
  eq(overview.trialDebit, overview.trialCredit);
  console.log(
    `PASS customer credit, cash closing, atomic failures, balanced immutable journals, inventory reconciliation and closed periods. ${assertions} assertions.`,
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());

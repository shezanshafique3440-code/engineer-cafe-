/** Real HTTP + balanced ledger checks on the existing disposable operations fixture. */
const assert = require("node:assert/strict"),
  { randomUUID } = require("node:crypto");
const { Pool } = require(process.env.CAFE_TEST_PG_MODULE || "pg");
const base = process.env.CAFE_BUSINESS_TEST_URL || "http://127.0.0.1:4180";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const db = new Pool({
  host: "127.0.0.1",
  user: "agent",
  database: "cafe_operations_test",
});
let checks = 0;
const eq = (a, b, message) => {
  assert.equal(a, b, message);
  checks++;
};
const sql = async (q, p) => (await db.query(q, p)).rows;
async function login(email) {
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "127.0.0.44",
    },
    body: JSON.stringify({ email, password: "Business-QA-123!" }),
  });
  eq(r.status, 200, await r.clone().text());
  return r.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
}
async function call(
  cookie,
  path,
  body,
  expected = 200,
  method = body ? "POST" : "GET",
) {
  const r = await fetch(base + path, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await r.json();
  eq(r.status, expected, path + " " + JSON.stringify(j));
  return j;
}
const post = async (cookie, module, body, expected = 200) =>
  (
    await call(
      cookie,
      "/api/admin/business/" + module,
      { requestId: randomUUID(), ...body },
      expected,
    )
  ).result;
const balance = async (code) =>
  Number(
    (
      await sql(
        'SELECT COALESCE(SUM(p.debit-p.credit),0)::text value FROM "BusinessPosting" p JOIN "BusinessAccount" a ON a.id=p."accountId" WHERE a.code=$1 OR a.id=$1',
        [code],
      )
    )[0].value,
  );
(async () => {
  eq(
    (await sql("SELECT current_database() name"))[0].name,
    "cafe_operations_test",
  );
  await sql(
    'INSERT INTO "Product" (id,name,slug,description,"categoryId",price,"recipeRequired","updatedAt") SELECT $1,$2,$3,$4,"categoryId",20,false,NOW() FROM "Product" WHERE id=$5 ON CONFLICT (id) DO NOTHING',
    [
      "delivery-offline-service",
      "Delivery/offline QA service",
      "delivery-offline-service",
      "Isolated no-ingredient fixture",
      "business-service",
    ],
  );
  const owner = await login("business-owner@example.test"),
    cashier = await login("cashier@example.test"),
    chef = await login("chef@example.test");
  const own = (await call(owner, "/api/auth/me")).user;
  async function ensureShift(cookie, user) {
    let active = (
      await sql(
        'SELECT s.id,d."accountId" FROM "CashShift" s JOIN "CashDrawer" d ON d.id=s."drawerId" WHERE s."openedById"=$1 AND s."closedAt" IS NULL',
        [user.id],
      )
    )[0];
    if (!active) {
      const account = await post(owner, "setup", {
        action: "ACCOUNT",
        kind: "CASH",
        name: "Delivery/offline QA " + randomUUID().slice(0, 8),
      });
      const drawer = (
        await sql('SELECT id FROM "CashDrawer" WHERE "accountId"=$1', [
          account.id,
        ])
      )[0];
      const shift = await post(cookie, "cash", {
        action: "OPEN",
        drawerId: drawer.id,
        amount: "0",
        note: "Isolated counter opening",
      });
      active = { id: shift.id, accountId: account.id };
    }
    return active;
  }
  const shift = await ensureShift(owner, own);
  await call(chef, "/api/admin/business/delivery", undefined, 403);
  const code = "R" + randomUUID().slice(0, 7).toUpperCase();
  const rider = await post(owner, "delivery", {
    action: "SAVE",
    code,
    name: "QA Rider",
    phone: "03001234567",
    isActive: true,
  });
  const makeDelivery = async () => {
    const r = await fetch(base + "/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "127.0.0.44",
      },
      body: JSON.stringify({
        requestId: randomUUID(),
        lines: [
          { productId: "delivery-offline-service", quantity: 5, addonIds: [] },
        ],
        orderType: "DELIVERY",
        paymentMethod: "CASH_ON_DELIVERY",
        customerName: "Rider QA",
        customerPhone: "03001234567",
        addressLine: "Test street 12",
        city: "Islamabad",
        saveAddress: false,
        redeemReward: false,
      }),
    });
    const j = await r.json();
    eq(r.status, 201, JSON.stringify(j));
    return j.order;
  };
  const order = await makeDelivery();
  await call(
    owner,
    "/api/admin/orders/" + order.id,
    { status: "OUT_FOR_DELIVERY", note: "No assigned rider" },
    400,
    "PATCH",
  );
  let version = (
    await sql('SELECT "updatedAt" FROM "Order" WHERE id=$1', [order.id])
  )[0].updatedAt.toISOString();
  const assignment = {
    action: "ASSIGN",
    riderId: rider.id,
    orderId: order.id,
    version,
    note: "Dispatch allocation",
  };
  await post(owner, "delivery", assignment);
  await post(owner, "delivery", assignment, 409);
  for (const status of [
    "CONFIRMED",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ])
    await call(
      owner,
      "/api/admin/orders/" + order.id,
      { status, note: "Delivery test " + status },
      200,
      "PATCH",
    );
  const earned = (
    await sql('SELECT * FROM "DeliveryCommission" WHERE "orderId"=$1', [
      order.id,
    ])
  )[0];
  eq(earned.rate, 15);
  eq(Number(earned.basis), order.subtotal - order.discount);
  eq(
    Number(earned.amount),
    Math.round((order.subtotal - order.discount) * 15) / 100,
  );
  const initial = await call(owner, "/api/admin/business/delivery");
  const report = initial.riders.find((r) => r.id === rider.id);
  eq(Number(report.cashHeld), order.total);
  eq(Number(report.due), Number(earned.amount));
  eq(report.delivered, 1);
  const payout = {
    requestId: randomUUID(),
    action: "SETTLE",
    riderId: rider.id,
    accountId: "RIDER_CASH",
    amount: earned.amount,
    note: "Rider retained commission",
  };
  await post(cashier, "delivery", payout, 403);
  const paid = await post(owner, "delivery", payout);
  const again = await post(owner, "delivery", payout);
  eq(paid.id, again.id);
  await post(owner, "delivery", { ...payout, requestId: randomUUID() }, 400);
  const remaining = (order.total - Number(earned.amount)).toFixed(2);
  const remit = {
    requestId: randomUUID(),
    action: "REMIT",
    riderId: rider.id,
    accountId: shift.accountId,
    amount: remaining,
    note: "Rider handed over delivery cash",
  };
  const drawerBefore = await balance(shift.accountId);
  const received = await post(owner, "delivery", remit);
  eq((await post(owner, "delivery", remit)).id, received.id);
  eq(await balance(shift.accountId), drawerBefore + Number(remaining));
  let r = (await call(owner, "/api/admin/business/delivery")).riders.find(
    (r) => r.id === rider.id,
  );
  eq(Number(r.due), 0);
  eq(Number(r.cashHeld), 0);
  await post(
    owner,
    "delivery",
    { ...remit, requestId: randomUUID(), amount: "0.01" },
    400,
  );
  await call(
    owner,
    "/api/admin/orders/" + order.id,
    { status: "CANCELLED", note: "Customer cancelled delivered test order" },
    200,
    "PATCH",
  );
  await call(
    owner,
    "/api/admin/orders/" + order.id,
    { status: "CANCELLED", note: "Duplicate cancellation" },
    400,
    "PATCH",
  );
  r = (await call(owner, "/api/admin/business/delivery")).riders.find(
    (r) => r.id === rider.id,
  );
  eq(Number(r.due), -Number(earned.amount));
  eq(Number(r.reversed), Number(earned.amount));
  eq(r.delivered, 0);
  const recovery = {
    requestId: randomUUID(),
    action: "RECOVER",
    riderId: rider.id,
    accountId: shift.accountId,
    amount: earned.amount,
    note: "Actual recovery of reversed commission",
  };
  const recovered = await post(owner, "delivery", recovery);
  eq((await post(owner, "delivery", recovery)).id, recovered.id);
  r = (await call(owner, "/api/admin/business/delivery")).riders.find(
    (r) => r.id === rider.id,
  );
  eq(Number(r.due), 0);
  eq(Number(r.recovered), Number(earned.amount));
  await assert.rejects(
    db.query('UPDATE "DeliveryTransfer" SET amount=0.01 WHERE id=$1', [
      paid.id,
    ]),
    /cannot be edited/,
  );
  checks++;
  await assert.rejects(
    db.query('UPDATE "DeliveryCommission" SET amount=0.01 WHERE id=$1', [
      earned.id,
    ]),
    /immutable/,
  );
  checks++;
  const canceled = await makeDelivery();
  await call(
    owner,
    "/api/admin/orders/" + canceled.id,
    { status: "CANCELLED", note: "Cancelled before delivery" },
    200,
    "PATCH",
  );
  eq(
    (
      await sql(
        'SELECT count(*)::int n FROM "DeliveryCommission" WHERE "orderId"=$1',
        [canceled.id],
      )
    )[0].n,
    0,
  );
  console.log(
    "PASS rider profiles, assignments, 15% accrual, commission payouts/recovery, cash remittance, idempotency, cancellation and immutable history.",
  );
  // Offline requests go through the same stock, receipt and journal transaction as online POS.
  const snapshot = await call(owner, "/api/admin/offline-pos");
  eq(snapshot.user.id, own.id);
  eq(snapshot.shift.id, shift.id);
  const protocol = await fetch(base + "/api/admin/offline-pos", {
    method: "HEAD",
    headers: { Cookie: owner },
  });
  eq(protocol.headers.get("x-cafe-offline-protocol"), "1");
  const quote = (
    await call(owner, "/api/cart/quote", {
      lines: [
        { productId: "delivery-offline-service", quantity: 1, addonIds: [] },
      ],
      orderType: "PICKUP",
    })
  ).quote;
  const payload = {
    requestId: randomUUID(),
    offline: true,
    shiftId: shift.id,
    accountId: shift.accountId,
    lines: [
      { productId: "delivery-offline-service", quantity: 1, addonIds: [] },
    ],
    expectedTotal: quote.total,
    cashReceived: quote.total + 10.25,
    customerName: "Offline QA",
  };
  const counterBefore = (await sql('SELECT value FROM "OrderCounter" WHERE id=1'))[0].value;
  const [first, second] = await Promise.all([
    call(owner, "/api/admin/pos", payload, 201),
    call(owner, "/api/admin/pos", payload, 201),
  ]);
  eq(first.order.id, second.order.id);
  eq((await sql('SELECT value FROM "OrderCounter" WHERE id=1'))[0].value, counterBefore + 1);
  eq(
    (
      await sql(
        'SELECT count(*)::int n FROM "BusinessPayment" WHERE "orderId"=$1',
        [first.order.id],
      )
    )[0].n,
    1,
  );
  eq(first.order.paymentStatus, "PAID");
  eq(Number(first.order.cashChange), 10.25);
  const wrongPrice = { ...payload, requestId: randomUUID(), expectedTotal: 1 };
  await call(owner, "/api/admin/pos", wrongPrice, 409);
  eq(
    (
      await sql('SELECT count(*)::int n FROM "Order" WHERE "requestKey"=$1', [
        "POS:" + wrongPrice.requestId,
      ])
    )[0].n,
    0,
  );
  const corrected = await call(
    owner,
    "/api/admin/pos",
    { ...wrongPrice, expectedTotal: quote.total },
    201,
  );
  await call(
    owner,
    "/api/admin/pos",
    { ...wrongPrice, expectedTotal: quote.total + 1 },
    409,
  );
  await sql('UPDATE "Product" SET stock=0 WHERE id=$1', [
    "delivery-offline-service",
  ]);
  await call(
    owner,
    "/api/admin/pos",
    { ...payload, requestId: randomUUID() },
    400,
  );
  await sql('UPDATE "Product" SET stock=NULL WHERE id=$1', [
    "delivery-offline-service",
  ]);
  await call(
    owner,
    "/api/admin/pos",
    { ...payload, requestId: randomUUID(), credit: true },
    400,
  );
  const modePayload = {
    ...payload,
    requestId: randomUUID(),
    serviceMode: "TAKEAWAY",
    expectedLineTotals: quote.lines.map((l) => l.lineTotal),
  };
  const onlineOffline = (
    await call(owner, "/api/admin/offline-pos", modePayload, 201)
  ).order;
  eq(onlineOffline.serviceMode, "TAKEAWAY");
  await call(
    owner,
    "/api/admin/offline-pos",
    { ...modePayload, requestId: randomUUID(), expectedLineTotals: [1] },
    409,
  );
  const table = await post(owner, "tables", {
    action: "SAVE",
    name: "Offline table " + randomUUID().slice(0, 5),
    seats: 4,
    isActive: true,
  });
  const session = await post(owner, "tables", {
    action: "OPEN",
    tableId: table.id,
    guestCount: 2,
  });
  const dine = (
    await call(
      owner,
      "/api/admin/offline-pos",
      {
        ...modePayload,
        requestId: randomUUID(),
        serviceMode: "DINE_IN",
        sessionId: session.id,
      },
      201,
    )
  ).order;
  eq(dine.serviceMode, "DINE_IN");
  eq(dine.tableSessionId, session.id);
  eq(dine.paymentStatus, "PAID");
  await call(
    owner,
    "/api/admin/orders/" + dine.id,
    { status: "DELIVERED", note: "Offline table ticket served" },
    200,
    "PATCH",
  );
  await post(owner, "tables", { action: "CLOSE", sessionId: session.id });
  await call(
    owner,
    "/api/admin/offline-pos",
    {
      ...modePayload,
      requestId: randomUUID(),
      serviceMode: "DINE_IN",
      sessionId: session.id,
    },
    400,
  );
  const deliveryQuote = (
    await call(owner, "/api/cart/quote", {
      lines: payload.lines,
      orderType: "DELIVERY",
    })
  ).quote;
  const prepaid = (
    await call(
      owner,
      "/api/admin/offline-pos",
      {
        ...modePayload,
        requestId: randomUUID(),
        serviceMode: "DELIVERY",
        expectedTotal: deliveryQuote.total,
        cashReceived: deliveryQuote.total + 10.25,
        customerPhone: "03001234567",
        addressLine: "Offline delivery street 12",
        city: "Islamabad",
      },
      201,
    )
  ).order;
  eq(prepaid.serviceMode, "DELIVERY");
  eq(prepaid.paymentStatus, "PAID");
  const prepaidVersion = (
    await sql('SELECT "updatedAt" FROM "Order" WHERE id=$1', [prepaid.id])
  )[0].updatedAt.toISOString();
  await post(owner, "delivery", {
    action: "ASSIGN",
    riderId: rider.id,
    orderId: prepaid.id,
    version: prepaidVersion,
    note: "Assign prepaid offline delivery",
  });
  const activeRider = (
    await call(owner, "/api/admin/business/delivery")
  ).riders.find((r) => r.id === rider.id);
  await post(
    owner,
    "delivery",
    {
      action: "SAVE",
      id: rider.id,
      version: activeRider.version,
      code,
      name: "QA Rider",
      phone: "03001234567",
      isActive: false,
    },
    400,
  );
  await call(
    owner,
    "/api/admin/orders/" + prepaid.id,
    { status: "DELIVERED", note: "Prepaid delivery handed over" },
    200,
    "PATCH",
  );
  const prepaidReport = (
    await call(owner, "/api/admin/business/delivery")
  ).riders.find((r) => r.id === rider.id);
  eq(Number(prepaidReport.cashHeld), 0);
  eq(
    Number(
      (
        await sql(
          'SELECT amount FROM "DeliveryCommission" WHERE "orderId"=$1',
          [prepaid.id],
        )
      )[0].amount,
    ),
    Math.round((prepaid.subtotal - prepaid.discount) * 15) / 100,
  );
  console.log(
    "PASS offline takeaway, cash-paid table tickets, closed-table conflicts, prepaid delivery, line-price checks and delivery commission without invented rider cash.",
  );
  const cashierUser = (await call(cashier, "/api/auth/me")).user;
  const cashierShift = await ensureShift(cashier, cashierUser);
  const cashierBill = {
    ...payload,
    requestId: randomUUID(),
    shiftId: cashierShift.id,
    accountId: cashierShift.accountId,
  };
  const saved = (await call(cashier, "/api/admin/pos", cashierBill, 201)).order;
  await post(owner, "setup", {
    action: "ACCESS",
    userId: cashierUser.id,
    profile: "CASHIER",
    employeeId: cashierUser.employeeId,
    customPermissions: true,
    permissions: ["pos", "orders", "cash"],
  });
  eq(
    (await call(cashier, "/api/admin/pos", cashierBill, 201)).order.id,
    saved.id,
  );
  await post(owner, "setup", {
    action: "ACCESS",
    userId: cashierUser.id,
    profile: "CASHIER",
    employeeId: cashierUser.employeeId,
    customPermissions: true,
    permissions: ["orders"],
  });
  await call(cashier, "/api/admin/pos", cashierBill, 403);
  await post(owner, "setup", {
    action: "ACCESS",
    userId: cashierUser.id,
    profile: "CASHIER",
    employeeId: cashierUser.employeeId,
    customPermissions: false,
    permissions: [],
  });
  await call(
    owner,
    "/api/admin/pos",
    {
      ...payload,
      requestId: randomUUID(),
      shiftId: cashierShift.id,
      accountId: cashierShift.accountId,
    },
    409,
  );
  // Closing cannot silently move a queued bill into a different shift.
  const pendingId = randomUUID();
  const closing = (await balance(shift.accountId)).toFixed(2);
  await post(owner, "cash", {
    action: "CLOSE",
    shiftId: shift.id,
    amount: closing,
    note: "Exact counter close",
  });
  await call(
    owner,
    "/api/admin/pos",
    { ...payload, requestId: pendingId },
    409,
  );
  eq(
    (
      await sql('SELECT count(*)::int n FROM "Order" WHERE "requestKey"=$1', [
        "POS:" + pendingId,
      ])
    )[0].n,
    0,
  );
  eq(
    (await call(owner, "/api/admin/pos", payload, 201)).order.id,
    first.order.id,
  );
  const drawer = (
    await sql('SELECT "drawerId" FROM "CashShift" WHERE id=$1', [shift.id])
  )[0];
  const fresh = await post(owner, "cash", {
    action: "OPEN",
    drawerId: drawer.drawerId,
    amount: closing,
    note: "Reconciled next shift",
  });
  const moved = await call(
    owner,
    "/api/admin/pos",
    { ...payload, requestId: pendingId, shiftId: fresh.id },
    201,
  );
  eq(moved.order.paymentStatus, "PAID");
  eq(
    (
      await sql(
        'SELECT count(*)::int n FROM "BusinessAudit" WHERE action=$1 AND "entityId"=$2',
        ["SYNC_OFFLINE_BILL", first.order.id],
      )
    )[0].n,
    1,
  );
  eq(
    (
      await sql(
        'SELECT count(*)::int n FROM (SELECT j.id FROM "BusinessJournal" j JOIN "BusinessPosting" p ON p."journalId"=j.id GROUP BY j.id HAVING SUM(p.debit)<>SUM(p.credit)) bad',
      )
    )[0].n,
    0,
  );
  console.log(
    `PASS offline HTTP: duplicate UUIDs, exact receipts/change, price/stock conflicts, permission changes, original cashier/shift, safe replay after close and balanced accounting. ${checks} assertions.`,
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());

/** Additional price/settings/status audit and tax checks on isolated operations data. */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Pool } = require(process.env.CAFE_TEST_PG_MODULE || "pg");
const base = process.env.CAFE_BUSINESS_TEST_URL || "http://127.0.0.1:4180";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const db = new Pool({
  host: "127.0.0.1",
  user: "agent",
  database: "cafe_operations_test",
});
let checks = 0;
const eq = (a, b, m) => {
  assert.equal(a, b, m);
  checks++;
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
    .map((s) => s.split(";")[0])
    .join("; ");
  return async (path, body, method = body ? "POST" : "GET", expected = 200) => {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const j = await res.json();
    eq(res.status, expected, JSON.stringify(j));
    return j;
  };
}
(async () => {
  eq(
    (await db.query("SELECT current_database() AS name")).rows[0].name,
    "cafe_operations_test",
  );
  const owner = await login("business-owner@example.test"),
    manager = await login("manager@example.test"),
    cashier = await login("cashier@example.test");
  const category = (
    await db.query('SELECT "categoryId" FROM "Product" LIMIT 1')
  ).rows[0].categoryId;
  let product = (
    await manager(
      "/api/admin/products",
      {
        name: "Audit QA " + randomUUID().slice(0, 8),
        description: "Hidden audit fixture",
        price: 110,
        categoryId: category,
        isAvailable: false,
      },
      "POST",
      201,
    )
  ).product;
  product = (
    await manager(
      "/api/admin/products/" + product.id,
      {
        ...product,
        urduName: product.urduName || "",
        longDescription: product.longDescription || "",
        image: product.image || "",
        price: 125,
        addonGroupIds: [],
      },
      "PUT",
    )
  ).product;
  const edits = (
    await db.query(
      'SELECT "actorName",details FROM "BusinessAudit" WHERE "entityId"=$1 AND action=$2',
      [product.id, "UPDATE_PRODUCT"],
    )
  ).rows;
  eq(edits.length, 1);
  eq(edits[0].actorName, "QA MANAGER");
  eq(edits[0].details.before.price, 110);
  eq(edits[0].details.after.price, 125);
  await manager("/api/admin/products/" + product.id, null, "DELETE");
  eq(
    (
      await db.query(
        'SELECT COUNT(*)::int AS n FROM "BusinessAudit" WHERE "entityId"=$1',
        [product.id],
      )
    ).rows[0].n,
    3,
  );
  const settings = (await owner("/api/admin/settings")).settings;
  for (const key of ["logoUrl", "instagramUrl", "facebookUrl", "tiktokUrl"])
    settings[key] ||= "";
  try {
    await owner("/api/admin/settings", { ...settings, taxPercent: 16 }, "PUT");
    const lines = [
      { productId: "business-paratha", quantity: 1, addonIds: [] },
    ];
    const approval = (
      await cashier("/api/admin/business/approvals", {
        requestId: randomUUID(),
        action: "REQUEST",
        kind: "DISCOUNT",
        amount: "25",
        reason: "Tax calculation verification",
        lines,
      })
    ).result;
    eq(approval.context.items[0].name, "Aloo Paratha");
    eq(approval.context.subtotal, 200);
    await manager("/api/admin/business/approvals", {
      requestId: randomUUID(),
      action: "DECIDE",
      id: approval.id,
      approved: true,
      note: "Exact cart reviewed",
    });
    await owner(
      "/api/admin/pos",
      {
        requestId: randomUUID(),
        approvalId: approval.id,
        lines,
        cashReceived: 203,
        accountId: "BANK",
      },
      "POST",
      403,
    );
    const sale = (
      await cashier(
        "/api/admin/pos",
        {
          requestId: randomUUID(),
          approvalId: approval.id,
          lines,
          cashReceived: 203,
          accountId: "BANK",
          expectedTotal: 203,
        },
        "POST",
        201,
      )
    ).order;
    eq(sale.subtotal, 200);
    eq(sale.discount, 25);
    eq(sale.tax, 28);
    eq(sale.total, 203);
    await owner(
      "/api/admin/orders/" + sale.id,
      { status: "DELIVERED", note: "Audit lifecycle verification" },
      "PATCH",
    );
    eq(
      (
        await db.query(
          'SELECT COUNT(*)::int AS n FROM "BusinessAudit" WHERE action=$1 AND "entityId"=$2',
          ["UPDATE_ORDER_STATUS", sale.id],
        )
      ).rows[0].n,
      1,
    );
    eq(
      (
        await db.query(
          'SELECT COUNT(*)::int AS n FROM "BusinessAudit" WHERE action=$1 AND "entityId"=$2',
          ["USE_DISCOUNT_APPROVAL", approval.id],
        )
      ).rows[0].n,
      1,
    );
    eq(
      (
        await db.query(
          "SELECT details->'changes'->0->>'field' AS field FROM \"BusinessAudit\" WHERE action=$1 ORDER BY \"createdAt\" DESC LIMIT 1",
          ["UPDATE_CAFE_SETTINGS"],
        )
      ).rows[0].field,
      "taxPercent",
    );
  } finally {
    await owner("/api/admin/settings", settings, "PUT");
  }
  eq(
    Number(
      (
        await db.query(
          'SELECT SUM(debit-credit)::text AS delta FROM "BusinessPosting"',
        )
      ).rows[0].delta,
    ),
    0,
  );
  console.log(
    "PASS price/settings/status audit, reviewer cart detail, cashier binding and tax after discount. " +
      checks +
      " assertions.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());

/** Regression tests for audited defects. All data is disposable localhost fixtures. */
const assert = require("node:assert/strict");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const url = new URL(process.env.DATABASE_URL);
assert.ok(
  ["localhost", "127.0.0.1"].includes(url.hostname) &&
    url.pathname === "/cafe_operations_test",
);
const base = process.env.CAFE_BUSINESS_TEST_URL;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const db = new PrismaClient();
const write = (fn) =>
  db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(73190422)`;
    await tx.$queryRaw`SELECT set_config('cafe.business_session','1',true)`;
    return fn(tx);
  });
const tag = "hardening-" + randomUUID();
let checks = 0;
const eq = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
let owner, masked, category, product, order;
async function token(user) {
  const { SignJWT } = await import("jose");
  return (
    "ec_session=" +
    (await new SignJWT({
      name: user.name,
      email: user.email,
      role: user.role,
      sv: user.sessionVersion,
    })
      .setSubject(user.id)
      .setIssuer("engineer-cafe")
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET)))
  );
}
async function call(
  path,
  { cookie, body, method = body ? "POST" : "GET", headers = {} } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Real-IP": "192.0.2.220",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { r, j: await r.json() };
}
(async () => {
  try {
    owner = await db.user.create({
      data: {
        name: "Audit test owner",
        email: tag + "@example.test",
        role: "ADMIN",
        passwordHash: await bcrypt.hash("Audit-Password-123!", 4),
      },
    });
    masked = await db.user.create({
      data: {
        name: "Restricted staff",
        email: tag + "-staff@example.test",
        role: "STAFF",
        passwordHash: "unusable",
        staffAccess: {
          create: {
            profile: "CASHIER",
            customPermissions: true,
            permissions: ["cash"],
          },
        },
      },
    });
    category = await db.category.create({
      data: { name: "Audit fixtures", slug: tag },
    });
    product = await db.product.create({
      data: {
        name: "Audit meal",
        slug: tag,
        categoryId: category.id,
        description: "Disposable audit fixture",
        price: 100,
        stock: 10,
        soldCount: 2,
        recipeRequired: false,
      },
    });
    order = await write((tx) =>
      tx.order.create({
        data: {
          orderNumber: tag,
          channel: "WEB",
          customerName: "PRIVATE PERSON",
          customerPhone: "03001234567",
          customerEmail: "private@example.test",
          orderType: "PICKUP",
          paymentMethod: "CASH_AT_COUNTER",
          status: "CONFIRMED",
          subtotal: 200,
          total: 200,
          items: {
            create: {
              productId: product.id,
              productName: product.name,
              productSlug: product.slug,
              unitPrice: 100,
              quantity: 2,
              lineTotal: 200,
            },
          },
        },
      }),
    );
    const cookie = await token(owner);
    eq(
      (await call("/api/orders/" + order.id)).r.status,
      404,
      "No private order by UUID without capability",
    );
    eq(
      (await call("/api/orders/" + tag)).r.status,
      404,
      "No private order by order number",
    );
    eq(
      (await call("/api/orders/" + order.id, { cookie: await token(masked) })).r
        .status,
      404,
      "Staff permission mask enforced",
    );
    const privateRead = await call("/api/admin/orders/" + order.id, { cookie });
    eq(privateRead.r.status, 200, "Owner authorized");
    const tracking = privateRead.j.order.trackingPath.split("?")[1];
    const guest = await call("/api/orders/" + order.id + "?" + tracking);
    eq(guest.r.status, 200, "Capability allows safe tracking");
    for (const secret of [
      "PRIVATE PERSON",
      "03001234567",
      "private@example.test",
    ])
      eq(
        JSON.stringify(guest.j).includes(secret),
        false,
        "Public DTO omits " + secret,
      );
    eq(
      (await call("/api/orders/" + order.id + "?tracking=invalid")).r.status,
      404,
      "Forged capability denied",
    );
    const second = await write((tx) =>
      tx.order.create({
        data: {
          orderNumber: tag + "-other",
          customerName: "OTHER PRIVATE",
          customerPhone: "03000000000",
          orderType: "PICKUP",
          paymentMethod: "CASH_AT_COUNTER",
          subtotal: 1,
          total: 1,
        },
      }),
    );
    eq(
      (await call("/api/orders/" + second.id + "?" + tracking)).r.status,
      404,
      "Capability cannot read another order",
    );
    await write((tx) => tx.order.delete({ where: { id: second.id } }));
    await write((tx) =>
      tx.order.update({
        where: { id: order.id },
        data: { placedAt: new Date(Date.now() - 31 * 86400000) },
      }),
    );
    const old = await call("/api/admin/orders/" + order.id, { cookie });
    eq(
      (
        await call(
          "/api/orders/" +
            order.id +
            "?" +
            old.j.order.trackingPath.split("?")[1],
        )
      ).r.status,
      404,
      "Expired link denied",
    );
    await write((tx) =>
      tx.order.update({
        where: { id: order.id },
        data: { placedAt: new Date() },
      }),
    );
    const current = (await call("/api/admin/orders/" + order.id, { cookie })).j
      .order;
    const body = {
      requestId: randomUUID(),
      version: current.version,
      preview: true,
      lines: [
        { productId: product.id, quantity: 3, addonIds: [], notes: "No spice" },
      ],
    };
    const preview = await call("/api/admin/orders/" + order.id, {
      cookie,
      body,
      method: "PUT",
    });
    eq(preview.r.status, 200, JSON.stringify(preview.j));
    eq(
      (await db.product.findUnique({ where: { id: product.id } })).stock,
      10,
      "Preview stock restoration rolled back",
    );
    eq(
      (await db.order.findUnique({ where: { id: order.id } })).total,
      200,
      "Preview does not save order",
    );
    const savedBody = {
      ...body,
      preview: false,
      expectedTotal: preview.j.quote.total,
    };
    const saved = await call("/api/admin/orders/" + order.id, {
      cookie,
      body: savedBody,
      method: "PUT",
    });
    eq(saved.r.status, 200, JSON.stringify(saved.j));
    eq(saved.j.order.items[0].quantity, 3, "Order quantities edited");
    eq(saved.j.order.items[0].notes, "No spice", "Kitchen notes edited");
    eq(
      (await db.product.findUnique({ where: { id: product.id } })).stock,
      9,
      "Stock reserved by difference only",
    );
    const events = await db.orderEvent.count({ where: { orderId: order.id } });
    eq(
      (
        await call("/api/admin/orders/" + order.id, {
          cookie,
          body: savedBody,
          method: "PUT",
        })
      ).r.status,
      200,
      "Identical edit retry succeeds",
    );
    eq(
      await db.orderEvent.count({ where: { orderId: order.id } }),
      events,
      "Edit retry does not duplicate event",
    );
    eq(
      (
        await call("/api/admin/orders/" + order.id, {
          cookie,
          body: { ...savedBody, expectedTotal: 1 },
          method: "PUT",
        })
      ).r.status,
      409,
      "Reused edit ID with changed body rejected",
    );
    eq(
      (
        await call("/api/admin/orders/" + order.id, {
          cookie,
          body: { ...savedBody, requestId: randomUUID() },
          method: "PUT",
        })
      ).r.status,
      409,
      "Stale version rejected",
    );
    await write((tx) =>
      tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: "PAID" },
      }),
    );
    const paid = await db.order.findUnique({ where: { id: order.id } });
    eq(
      (
        await call("/api/admin/orders/" + order.id, {
          cookie,
          body: { ...body, version: paid.updatedAt.toISOString() },
          method: "PUT",
        })
      ).r.status,
      400,
      "Paid ticket cannot be edited",
    );
    eq(
      (
        await call("/api/auth/me", {
          cookie,
          body: { name: "Cross site", phone: "" },
          method: "PATCH",
          headers: {
            Origin: "https://attacker.example",
            "Sec-Fetch-Site": "cross-site",
          },
        })
      ).r.status,
      403,
      "Cross-site mutation rejected",
    );
    const oversized = await fetch(base + "/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Real-IP": "192.0.2.221",
      },
      body: JSON.stringify({ payload: "x".repeat(70 * 1024) }),
    });
    eq(oversized.status, 413, "Oversized JSON rejected");
    // Image bytes, rather than a client MIME label, determine what can be stored.
    const fake = new FormData();
    fake.append(
      "file",
      new Blob(['<svg onload="alert(1)"></svg>'], { type: "image/png" }),
      "fake.png",
    );
    const fakeUpload = await fetch(base + "/api/admin/upload", {
      method: "POST",
      headers: { Cookie: cookie, "X-Real-IP": "192.0.2.220" },
      body: fake,
    });
    eq(fakeUpload.status, 400, "Disguised SVG is rejected");
    const image = await require("sharp")({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const real = new FormData();
    real.append("file", new Blob([image], { type: "image/png" }), "photo.png");
    const uploaded = await fetch(base + "/api/admin/upload", {
      method: "POST",
      headers: { Cookie: cookie, "X-Real-IP": "192.0.2.220" },
      body: real,
    });
    const asset = await uploaded.json();
    eq(uploaded.status, 201, JSON.stringify(asset));
    assert.match(asset.url, /^\/uploads\/[a-f0-9-]+\.webp$/);
    checks++;
    const readImage = await fetch(base + asset.url);
    eq(readImage.status, 200, "Runtime upload is served");
    eq(
      readImage.headers.get("content-type"),
      "image/webp",
      "Images are re-encoded",
    );
    await require("node:fs/promises").unlink(
      require("node:path").join(process.cwd(), "public", asset.url),
    );
    const expiredToken = randomBytes(32).toString("base64url");
    await db.passwordReset.create({
      data: {
        userId: owner.id,
        tokenHash: createHash("sha256").update(expiredToken).digest("hex"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    eq(
      (
        await call("/api/auth/reset-password", {
          body: { token: expiredToken, password: "Replacement-123!" },
        })
      ).r.status,
      400,
      "Expired reset cannot be claimed",
    );
    const resetToken = randomBytes(32).toString("base64url");
    await db.passwordReset.create({
      data: {
        userId: owner.id,
        tokenHash: createHash("sha256").update(resetToken).digest("hex"),
        expiresAt: new Date(Date.now() + 300000),
      },
    });
    eq(
      (
        await call("/api/auth/reset-password", {
          body: { token: resetToken, password: "Replacement-123!" },
        })
      ).r.status,
      200,
      "Reset succeeds",
    );
    eq(
      (await call("/api/auth/me", { cookie })).j.user,
      null,
      "Old JWT revoked after reset",
    );
    eq(
      (
        await call("/api/auth/reset-password", {
          body: { token: resetToken, password: "Replacement-456!" },
        })
      ).r.status,
      400,
      "Reset token cannot be reused",
    );
    const fresh = await token(
      await db.user.findUnique({ where: { id: owner.id } }),
    );
    eq(
      (
        await call("/api/auth/me", {
          cookie: fresh,
          body: {
            currentPassword: "Replacement-123!",
            newPassword: "Changed-789!",
          },
          method: "PATCH",
        })
      ).r.status,
      200,
      "Password change succeeds",
    );
    eq(
      (await call("/api/auth/me", { cookie: fresh })).j.user,
      null,
      "Password change revokes old session",
    );
    const signedIn = await token(
      await db.user.findUnique({ where: { id: owner.id } }),
    );
    eq(
      (await call("/api/auth/logout", { cookie: signedIn, body: {} })).r.status,
      200,
      "Logout succeeds",
    );
    eq(
      (await call("/api/auth/me", { cookie: signedIn })).j.user,
      null,
      "Logged-out token cannot be replayed",
    );
    eq((await call("/api/health")).r.status, 200, "Health checks database");
    eq(
      (await call("/api/admin/system")).r.status,
      401,
      "System diagnostics private",
    );
    console.log(
      `PASS: ${checks} hardening/privacy, permissions, editing, stock, CSRF, body limits and session-revocation checks.`,
    );
  } finally {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(73190422)`;
      await tx.$queryRaw`SELECT set_config('cafe.business_session','1',true)`;
      await tx.orderEvent.deleteMany({
        where: { orderId: order?.id || "none" },
      });
      await tx.order.deleteMany({ where: { id: order?.id || "none" } });
      await tx.product.deleteMany({ where: { id: product?.id || "none" } });
      await tx.category.deleteMany({ where: { id: category?.id || "none" } });
      await tx.staffAccess.deleteMany({
        where: { userId: masked?.id || "none" },
      });
      await tx.user.deleteMany({
        where: { id: { in: [owner?.id, masked?.id].filter(Boolean) } },
      });
    });
    await db.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

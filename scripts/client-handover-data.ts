/** Copies only configuration/catalogue into an unused client database. No ledger or test users. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { prisma as source } from "@/lib/prisma";
import { ensureBusiness } from "@/server/business/core";
export async function prepareClientHandover(apply = false) {
  const targetUrl = process.env.CAFE_CLIENT_DATABASE_URL;
  assert.ok(targetUrl, "Missing client database URL");
  const expected = new URL(targetUrl).pathname.slice(1);
  assert.ok(
    ["engineer_cafe_client", "cafe_client_handover_test"].includes(expected),
    "Only a dedicated client database is allowed",
  );
  const target =
    (globalThis as unknown as { clientHandoverTarget?: PrismaClient })
      .clientHandoverTarget ?? new PrismaClient({ datasourceUrl: targetUrl });
  try {
    const src = (
      await source.$queryRaw<
        { name: string }[]
      >`SELECT current_database()::text AS name`
    )[0].name;
    const dst = (
      await target.$queryRaw<
        { name: string }[]
      >`SELECT current_database()::text AS name`
    )[0].name;
    assert.equal(dst, expected);
    assert.notEqual(src, dst, "Source and client database must differ");
    const done = await target.businessRequest.findUnique({
      where: { key: "client-handover-v1" },
    });
    if (done) {
      console.log(
        "Clean client database already prepared; nothing overwritten.",
      );
      console.log(JSON.stringify(done.result, null, 2));
      return done.result;
    }
    if (!apply) {
      console.log(
        `Preview: copy catalogue/settings/admins from ${src} into empty ${dst}; no sales, money, customers or demo records. Current website database is not switched.`,
      );
      return;
    }
    const snapshot = await source.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        const categories = await tx.category.findMany({
          where: {
            id: { not: { startsWith: "cafe-demo-" } },
            slug: { not: "demo-training-menu" },
          },
        });
        const products = await tx.product.findMany({
          where: {
            id: { not: { startsWith: "cafe-demo-" } },
            categoryId: { in: categories.map((c) => c.id) },
          },
        });
        const groups = await tx.addonGroup.findMany();
        const addons = await tx.productAddon.findMany();
        const links = await tx.addonGroupOnProduct.findMany({
          where: { productId: { in: products.map((p) => p.id) } },
        });
        const admins = await tx.user.findMany({
          where: {
            role: "ADMIN",
            isActive: true,
            id: { not: { startsWith: "cafe-practice-" } },
          },
        });
        const settings = await tx.cafeSetting.findUnique({ where: { id: 1 } });
        const ingredients = await tx.ingredient.findMany({
          where: {
            id: { not: { startsWith: "cafe-demo-" } },
            name: { not: { startsWith: "DEMO" } },
          },
        });
        const allowed = new Set(ingredients.map((i) => i.id));
        const recipes = (
          await tx.recipe.findMany({ include: { lines: true } })
        ).filter(
          (r) =>
            !/(ASSUMED|DEMO|training)/i.test(r.note ?? "") &&
            r.lines.length &&
            r.lines.every((l) => allowed.has(l.ingredientId)) &&
            (!r.productId || products.some((p) => p.id === r.productId)),
        );
        return {
          categories,
          products,
          groups,
          addons,
          links,
          admins,
          settings,
          ingredients,
          recipes,
        };
      },
      { isolationLevel: "RepeatableRead", timeout: 30000 },
    );
    assert.ok(snapshot.admins.length, "A real administrator must exist");
    const result = await target.$transaction(
      async (tx) => {
        assert.equal(
          await tx.businessConfig.count(),
          0,
          "Client accounting config already exists; refusing to replace it",
        );
        assert.equal(
          (await tx.user.count()) +
            (await tx.product.count()) +
            (await tx.businessJournal.count()) +
            (await tx.order.count()),
          0,
          "Client database is not empty; refusing to overwrite it",
        );
        if (snapshot.settings)
          await tx.cafeSetting.create({
            data: { ...snapshot.settings, isAcceptingOrders: false },
          });
        await tx.user.createMany({
          data: snapshot.admins.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            passwordHash: u.passwordHash,
            role: u.role,
            isActive: u.isActive,
            phone: u.phone,
          })),
        });
        await tx.category.createMany({ data: snapshot.categories });
        await tx.product.createMany({
          data: snapshot.products.map((p) => ({
            ...p,
            stock: p.stock === null ? null : 0,
            soldCount: 0,
            ratingCount: 0,
            ratingAverage: 0,
          })),
        });
        await tx.addonGroup.createMany({ data: snapshot.groups });
        await tx.productAddon.createMany({ data: snapshot.addons });
        await tx.addonGroupOnProduct.createMany({ data: snapshot.links });
        if (snapshot.ingredients.length)
          await tx.ingredient.createMany({
            data: snapshot.ingredients.map((i) => ({
              ...i,
              quantity: "0.0000",
              stockValue: "0.00",
            })),
          });
        for (const { lines, ...recipe } of snapshot.recipes)
          await tx.recipe.create({
            data: {
              ...recipe,
              lines: {
                create: lines.map(({ ingredientId, quantity }) => ({
                  ingredientId,
                  quantity,
                })),
              },
            },
          });
        await ensureBusiness(tx);
        const result = {
          database: dst,
          sourceDatabase: src,
          products: snapshot.products.length,
          categories: snapshot.categories.length,
          admins: snapshot.admins.length,
          retainedActualRecipes: snapshot.recipes.length,
          orders: 0,
          financialEntries: 0,
          openingStock: 0,
          orderingEnabled: false,
          accountingEnabled: false,
          currentWebsiteSwitched: false,
          note: "Clean handover copy only. Enter real opening stock, costs, staff, salaries and balances before enabling orders.",
        };
        await tx.businessRequest.create({
          data: {
            key: "client-handover-v1",
            payloadHash: "catalogue-only-v1",
            result,
          },
        });
        return result;
      },
      { timeout: 60000 },
    );
    const folder = process.env.CAFE_CLIENT_OUTPUT;
    if (folder) {
      mkdirSync(folder, { recursive: true, mode: 0o700 });
      for (const [name, headers] of Object.entries({
        "opening-stock.csv":
          "Ingredient,Unit,Counted quantity,Total value,Reorder level",
        "staff.csv":
          "Name,Role,Monthly or daily,Pay rate,Overtime rate,Joining date",
        "supplier-dues.csv":
          "Supplier,Phone,Invoice reference,Outstanding amount",
        "customer-dues.csv": "Customer,Phone,Outstanding amount,Credit limit",
        "opening-money.csv":
          "Account,Cash counted or bank balance,Date,Reference",
      }))
        writeFileSync(path.join(folder, name), headers + "\n", { mode: 0o600 });
      writeFileSync(
        path.join(folder, "handover-summary.json"),
        JSON.stringify(result, null, 2),
        { mode: 0o600 },
      );
    }
    console.log(
      "PASS clean client database prepared; the practice website was not switched.",
    );
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await target.$disconnect();
  }
}

/** Disposable fixtures only; never run against the cafe's production database. */
const assert = require("node:assert/strict");
const connection = process.env.DATABASE_URL;
assert.ok(
  connection,
  "Set DATABASE_URL explicitly for the isolated test database.",
);
const url = new URL(connection);
const database = process.env.CAFE_TEST_DATABASE || "cafe_business_test";
assert.ok(
  ["cafe_business_test", "cafe_operations_test"].includes(database),
  "Disposable business/operations test database required.",
);
assert.ok(
  ["127.0.0.1", "localhost"].includes(url.hostname),
  "Local database required.",
);
assert.equal(
  url.pathname,
  "/" + database,
  "Only the explicitly selected disposable test database is permitted.",
);
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = globalThis.prisma || new PrismaClient();
(async () => {
  assert.equal(
    (await prisma.$queryRaw`SELECT current_database()::text AS name`)[0].name,
    database,
  );
  assert.equal(
    await prisma.businessJournal.count(),
    0,
    "A fresh disposable database is required.",
  );
  assert.equal(
    await prisma.user.count(),
    0,
    "Do not overwrite existing fixtures or accounts.",
  );
  await prisma.$transaction(async (tx) => {
    await tx.cafeSetting.create({ data: { id: 1, minOrderAmount: 0 } });
    const category = await tx.category.create({
      data: { name: "Cafe favourites", slug: "chai" },
    });
    await tx.product.createMany({
      data: [
        {
          id: "business-chai",
          name: "Karak Chai",
          urduName: "کڑک چائے",
          slug: "karak-chai",
          description: "Freshly brewed milk tea",
          categoryId: category.id,
          price: 150,
          image: "/menu/chai-doodh.svg",
          isFeatured: true,
        },
        {
          id: "business-paratha",
          name: "Aloo Paratha",
          urduName: "آلو پراٹھا",
          slug: "aloo-paratha",
          description: "Potato filled paratha",
          categoryId: category.id,
          price: 200,
          image: "/menu/paratha-aloo.svg",
          isFeatured: true,
        },
        {
          id: "business-service",
          name: "Packing",
          slug: "packing",
          description: "Packaging service",
          categoryId: category.id,
          price: 20,
          recipeRequired: false,
        },
      ],
    });
    await tx.user.create({
      data: {
        id: "business-owner",
        name: "Cafe Owner",
        email: "business-owner@example.test",
        passwordHash: await bcrypt.hash("Business-QA-123!", 10),
        role: "ADMIN",
      },
    });
  });
  console.log(
    "Created disposable business fixtures. No live database was accessed.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

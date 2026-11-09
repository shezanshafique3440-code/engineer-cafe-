import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { businessLock, ensureBusiness, journal } from "@/server/business/core";
import { adjustIngredient } from "@/server/business/inventory";
import { seedBusinessDemo, assumedRecipe } from "../business-demo-data";
import { planCleanup, cleanupPreview, queueDemo } from "@/server/demo-data";
import { tick } from "../demo-manager-worker";
import bcrypt from "bcryptjs";
import { createRequire } from "node:module";
const { PRODUCTS } = createRequire(process.cwd() + "/package.json")(
  "./prisma/seed-data.ts",
);
const actor = {
  id: "demo-qa-owner",
  name: "Preserved Owner",
  email: "owner@example.test",
  role: "ADMIN" as const,
};
let checks = 0;
function ok(value: unknown, message: string) {
  assert.ok(value, message);
  checks++;
}
async function rejected(fn: () => Promise<unknown>, message: string) {
  let refused = false;
  try {
    await fn();
  } catch {
    refused = true;
  }
  ok(refused, message);
}
export async function run() {
  ok(
    (
      await prisma.$queryRaw<
        { name: string }[]
      >`SELECT current_database() AS name`
    )[0].name === "cafe_demo_cleanup_test",
    "Test database guard",
  );
  ok((await prisma.user.count()) === 0, "Fresh database required");
  await prisma.$transaction(
    async (tx) => {
      await businessLock(tx);
      await ensureBusiness(tx);
      const category = await tx.category.create({
        data: { id: "real-category", name: "Real menu", slug: "real-menu" },
      });
      await tx.cafeSetting.create({ data: { id: 1 } });
      await tx.user.create({
        data: {
          id: actor.id,
          name: actor.name,
          email: actor.email,
          role: "ADMIN",
          passwordHash: await bcrypt.hash("Demo-QA-123!", 10),
        },
      });
      await tx.user.create({
        data: {
          id: "demo-qa-staff",
          name: "Preserved Staff",
          email: "staff@example.test",
          role: "STAFF",
          passwordHash: await bcrypt.hash("Demo-QA-123!", 10),
          staffAccess: { create: { profile: "MANAGER" } },
        },
      });
      const products = Object.values(PRODUCTS).flat() as any[];
      for (let i = 0; i < 35; i++) {
        const p = products[i % products.length];
        await tx.product.create({
          data: {
            id: "real-product-" + i,
            name: p.name + " " + i,
            slug: "real-product-" + i,
            description: p.description,
            price: p.price,
            image: p.image,
            categoryId: category.id,
          },
        });
      }
      for (let i = 0; i < 11; i++)
        await tx.order.create({
          data: {
            id: "preserved-order-" + i,
            orderNumber: "REAL" + i,
            customerName: "Preserved",
            customerPhone: "",
            orderType: "PICKUP",
            status: "DELIVERED",
            total: 150,
            subtotal: 150,
            items: {
              create: {
                productId: "real-product-0",
                productName: "Real chai",
                productSlug: "real-product-0",
                unitPrice: 150,
                quantity: 1,
                lineTotal: 150,
              },
            },
          },
        });
      await journal(tx, actor, {
        key: "real-capital",
        source: "CAPITAL",
        sourceId: actor.id,
        note: "Preserved funds",
        lines: [
          { code: "BANK", debit: 100000n },
          { code: "CAPITAL", credit: 100000n },
        ],
      });
    },
    { timeout: 60000 },
  );
  const preserved = await prisma.order.findMany({
    where: { id: { startsWith: "preserved-" } },
    orderBy: { id: "asc" },
  });
  const ownerBefore = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
  });
  const menuBefore = await prisma.product.findMany({ orderBy: { id: "asc" } });
  console.log(
    "Preparing the live-shaped legacy dataset (600 orders, 35 mixed recipes)…",
  );
  await seedBusinessDemo(true);
  await prisma.$transaction(async (tx) => {
    await businessLock(tx);
    const ingredients = await tx.ingredient.findMany({
      where: { id: { startsWith: "cafe-demo-v1-" } },
    });
    const map = new Map(
      ingredients.map((i) => [i.name.replace(/^DEMO · /, ""), i.id]),
    );
    for (const p of menuBefore)
      await tx.recipe.create({
        data: {
          productId: p.id,
          note: "ASSUMED / TEST figures requested for checking the system; not actual cafe records.",
          lines: { create: assumedRecipe(p.name, map) },
        },
      });
    await tx.businessRequest.create({
      data: {
        key: "business-practice-v1",
        payloadHash: "test",
        result: { demo: true },
      },
    });
  });
  const legacy = await cleanupPreview();
  ok(
    legacy.counts.Order.remove === 600 && legacy.counts.Order.preserve === 11,
    "Only known 600 demo orders selected",
  );
  ok(legacy.recipesToReview === 35, "35 assumed recipes explicitly converted");
  assert.deepEqual(legacy.blockers, []);
  checks++;
  console.log("Legacy preview passed. Testing the 2,000-order bulk job…");
  const job = await queueDemo("SEED", actor);
  await prisma.demoControl.update({
    where: { id: 1 },
    data: { maintenanceJob: job.id },
  });
  await rejected(
    () =>
      prisma.contactMessage.create({
        data: {
          name: "Blocked",
          email: "blocked@example.test",
          message: "Must not save during maintenance",
        },
      }),
    "Database rejects app writes during demo maintenance",
  );
  await prisma.demoControl.update({
    where: { id: 1 },
    data: { maintenanceJob: null },
  });
  await tick();
  const seeded = await prisma.demoJob.findUniqueOrThrow({
    where: { id: job.id },
  });
  if (seeded.status !== "DONE") throw Error("Seed job failed: " + seeded.error);
  ok(
    Boolean(seeded.backupHash) && Boolean(seeded.backupPath),
    "Verified backup before seed",
  );
  ok(
    (await prisma.order.count({
      where: { id: { startsWith: "cafe-demo-v2-" } },
    })) === 2000,
    "2000 extra orders",
  );
  ok((await prisma.deliveryRider.count()) === 25, "25 synthetic riders");
  ok(
    (await prisma.deliveryCommission.count()) > 400,
    "Delivery commissions accrued",
  );
  ok((await prisma.deliveryTransfer.count()) > 0, "Commission payouts present");
  ok(
    (await prisma.deliveryCommission.count({
      where: { reversedAt: { not: null } },
    })) === 6,
    "Commission reversal samples",
  );
  ok(
    (await prisma.notificationJob.count()) === 0,
    "No synthetic push notifications queued",
  );
  ok(
    (await prisma.category.count({ where: { isActive: true } })) === 1,
    "Demo category stays off public menu",
  );
  ok(
    (await prisma.coupon.count({
      where: { code: { startsWith: "DEMO2-" }, isActive: false },
    })) === 30,
    "30 inactive sample coupons",
  );
  ok(
    (await prisma.review.count({ where: { status: "PENDING" } })) === 48,
    "48 private pending reviews",
  );
  ok(
    (await prisma.cafePurchaseOrder.count()) === 9,
    "9 sample purchase orders",
  );
  ok((await prisma.cafeStockCount.count()) === 6, "6 sample stock counts");
  ok((await prisma.cafeApproval.count()) === 3, "3 sample refund approvals");
  await prisma.demoJob.update({
    where: { id: job.id },
    data: { status: "RUNNING" },
  });
  await prisma.demoControl.update({
    where: { id: 1 },
    data: { maintenanceJob: job.id },
  });
  await tick();
  ok(
    (await prisma.order.count({
      where: { id: { startsWith: "cafe-demo-v2-" } },
    })) === 2000,
    "Worker crash recovery does not duplicate the committed seed",
  );
  ok(
    (await prisma.demoControl.findUniqueOrThrow({ where: { id: 1 } }))
      .maintenanceJob === null,
    "Recovery releases maintenance",
  );
  const rewards = await prisma.loyaltyEntry.findMany({
    where: { userId: { startsWith: "cafe-demo-v2-" }, kind: "EARN" },
  });
  for (const reward of rewards) {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: reward.orderKey },
    });
    assert.equal(order.userId, reward.userId);
    assert.equal(order.loyaltyPointsEarned, reward.points);
    assert.equal(order.status, "DELIVERED");
  }
  ok(
    rewards.length === 48,
    "Sample loyalty points belong to 48 paid orders for the same customers",
  );
  const manifest = await prisma.demoRecord.count();
  ok(manifest > 20000, "Inserted row manifest captured");
  await rejected(() => queueDemo("SEED", actor), "Duplicate dataset rejected");
  const preview = await cleanupPreview();
  console.log(
    "Bulk preview:",
    JSON.stringify({
      total: preview.total,
      counts: preview.counts,
      blockers: preview.blockers.slice(0, 15),
    }),
  );
  assert.deepEqual(preview.blockers, []);
  checks++;
  ok(
    preview.counts.Order.remove === 2600 &&
      preview.counts.Order.preserve === 11,
    "Both old and new batches selected",
  );
  let actualStockPreserved = false;
  try {
    await prisma.$transaction(
      async (tx) => {
        await businessLock(tx);
        await adjustIngredient(tx, actor, {
          requestId: "actual-owner-stock-test",
          ingredientId: "cafe-demo-v1-ingredient-milk",
          kind: "OPENING",
          quantity: "1",
          value: "1",
          note: "Actual physical stock, not imported demo data",
        });
        const physical = await planCleanup(tx);
        assert.ok(
          physical.preview.blockers.some((b) =>
            b.includes("no recorded demo provenance"),
          ),
        );
        actualStockPreserved = true;
        throw Error("EXPECTED_PHYSICAL_STOCK_ROLLBACK");
      },
      { timeout: 90000 },
    );
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== "EXPECTED_PHYSICAL_STOCK_ROLLBACK"
    )
      throw error;
  }
  ok(
    actualStockPreserved,
    "Actual owner stock entries on demo ingredients block cleanup",
  );
  // Real references must block, even where ON DELETE would otherwise cascade/set null.
  await prisma.$transaction(async (tx) => {
    await businessLock(tx);
    await tx.orderItem.updateMany({
      where: { orderId: "preserved-order-0" },
      data: { productId: "cafe-demo-v2-product-0" },
    });
  });
  const mixed = await cleanupPreview();
  ok(mixed.blockers.length > 0, "Mixed genuine order blocks cleanup");
  await rejected(
    () => queueDemo("CLEANUP", actor, mixed.hash),
    "Cannot queue mixed cleanup",
  );
  await prisma.orderItem.updateMany({
    where: { orderId: "preserved-order-0" },
    data: { productId: "real-product-0" },
  });
  const staleChange = await prisma.contactMessage.create({
    data: {
      name: "Preserved message",
      email: "real@example.test",
      message: "Real change after preview",
    },
  });
  await rejected(
    () => queueDemo("CLEANUP", actor, preview.hash),
    "Stale preview rejected",
  );
  await prisma.contactMessage.delete({ where: { id: staleChange.id } });
  const clean = await cleanupPreview();
  // Unreviewed immutable data cannot be erased by setting a job variable alone.
  await rejected(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('cafe.demo_job','forged',true)`;
        await tx.businessJournal.deleteMany({
          where: { eventKey: "real-capital" },
        });
      }),
    "Genuine financial history immutable",
  );
  const beforeFailure = await prisma.order.count();
  const failed = await queueDemo("CLEANUP", actor, clean.hash);
  const dumpCommand = process.env.CAFE_PG_DUMP;
  process.env.CAFE_PG_DUMP = "/not-a-pg-dump";
  await tick();
  process.env.CAFE_PG_DUMP = dumpCommand;
  ok(
    (await prisma.demoJob.findUniqueOrThrow({ where: { id: failed.id } }))
      .status === "FAILED",
    "Backup failure prevents cleanup",
  );
  ok(
    (await prisma.order.count()) === beforeFailure,
    "Backup failure preserves every order",
  );
  ok(
    (await prisma.demoControl.findUniqueOrThrow({ where: { id: 1 } }))
      .maintenanceJob === null,
    "Maintenance released after failed backup",
  );
  const reset = await queueDemo(
    "CLEANUP",
    actor,
    (await cleanupPreview()).hash,
  );
  await tick();
  const done = await prisma.demoJob.findUniqueOrThrow({
    where: { id: reset.id },
  });
  if (done.status !== "DONE") throw Error("Reset failed: " + done.error);
  ok(Boolean(done.backupHash), "Verified backup before delete");
  assert.deepEqual(
    await prisma.order.findMany({ orderBy: { id: "asc" } }),
    preserved,
  );
  checks++;
  assert.deepEqual(
    await prisma.user.findUniqueOrThrow({ where: { id: actor.id } }),
    ownerBefore,
  );
  checks++;
  assert.deepEqual(
    await prisma.product.findMany({ orderBy: { id: "asc" } }),
    menuBefore,
  );
  checks++;
  ok(
    (await prisma.recipe.count({ where: { reviewRequired: true } })) === 35,
    "Practice recipes require review",
  );
  ok(
    (await prisma.ingredient.count({
      where: { OR: [{ quantity: { not: 0 } }, { stockValue: { not: 0 } }] },
    })) === 0,
    "No fake opening stock remains",
  );
  ok((await prisma.deliveryRider.count()) === 0, "Synthetic riders removed");
  ok(
    (await prisma.businessJournal.count()) === 1,
    "Only genuine capital journal remains",
  );
  ok((await prisma.demoRecord.count()) === 0, "Manifest cleared");
  ok((await cleanupPreview()).total === 0, "Repeated cleanup is empty");
  ok(
    (await prisma.businessRequest.count({
      where: { key: { in: ["business-demo-v1", "business-practice-v1"] } },
    })) === 2,
    "Old import markers retained to prevent accidental reseeding",
  );
  console.log(
    `PASS: ${checks} demo seed, cleanup, preservation and accounting checks.`,
  );
}

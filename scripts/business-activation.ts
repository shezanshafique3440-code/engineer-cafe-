/** Finish cutover without inventing a sale, receipt or refund. */
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { businessTx, audit } from "@/server/business/core";
import { businessAction } from "@/server/business/actions";
import { stockReadiness } from "@/server/business/inventory";
import { transitionOrder } from "@/server/orders";
import type { SessionUser } from "@/lib/types";
const actor: SessionUser = {
  id: "owner-requested-cutover",
  name: "Owner-requested accounting cutover",
  email: "",
  role: "ADMIN",
};
export async function finishBusinessSetup(apply = false) {
  const name = (
    await prisma.$queryRaw<
      { name: string }[]
    >`SELECT current_database()::text AS name`
  )[0].name;
  assert.ok(
    ["engineer_cafe", "cafe_business_test", "cafe_demo_seed_test"].includes(
      name,
    ),
    "Unexpected database; stopped.",
  );
  const requested = process.env.CAFE_CANCEL_TEST_ORDER;
  if (requested) {
    assert.match(
      requested,
      /^EC\d+$/,
      "Supply one exact confirmed test-order number.",
    );
    const order = await prisma.order.findUnique({
      where: { orderNumber: requested },
    });
    assert.ok(order, `Order ${requested} was not found.`);
    if (order.status !== "CANCELLED") {
      assert.equal(
        order.businessTracked,
        false,
        "A tracked financial order needs its normal payment/refund workflow.",
      );
      assert.ok(
        !["DELIVERED"].includes(order.status),
        "A delivered order cannot be treated as a stale unpaid test ticket.",
      );
      assert.ok(
        ["UNPAID", "FAILED"].includes(order.paymentStatus),
        "Paid orders need their actual refund handling first.",
      );
      if (apply) {
        await transitionOrder(
          order,
          "CANCELLED",
          "Owner confirmed this is a stale test ticket; cancelled for accounting cutover.",
          actor,
        );
        console.log(
          `Cancelled confirmed test ticket ${requested}; no sale, receipt or refund was invented.`,
        );
      } else
        console.log(
          `Preview: cancel the owner-confirmed unpaid test ticket ${requested}.`,
        );
    } else console.log(`${requested} is already cancelled; no repeat action.`);
  }
  const result = await businessTx(async (tx) => {
    const config = await tx.businessConfig.findUniqueOrThrow({
      where: { id: 1 },
    });
    const legacy = await tx.order.findMany({
      where: {
        businessTracked: false,
        status: { notIn: ["DELIVERED", "CANCELLED"] },
      },
      select: { orderNumber: true, status: true },
      orderBy: { placedAt: "asc" },
    });
    const readiness = await stockReadiness(tx);
    if (!config.enabled && (!readiness.ready || legacy.length))
      return {
        accountingActive: false,
        blocked: true,
        legacyOpenOrders: legacy,
        missingRecipes: readiness.missingRecipes,
      };
    if (!config.enabled && apply)
      await businessAction(tx, actor, "setup", {
        requestId: "8eab55d7-d3fd-4cc5-8832-a45e2c252521",
        action: "CONFIG",
        enabled: true,
        note: "Owner requested activation after recipe readiness and legacy-order checks.",
      });
    const updated = await tx.businessConfig.findUniqueOrThrow({
      where: { id: 1 },
    });
    if (apply)
      await audit(
        tx,
        actor,
        "VERIFY_ACCOUNTING_CUTOVER",
        "BusinessConfig",
        "1",
        {
          enabled: updated.enabled,
          legacyOpenCount: legacy.length,
          recipeReady: readiness.ready,
        },
      );
    const totals = await tx.businessPosting.aggregate({
      _sum: { debit: true, credit: true },
    });
    return {
      accountingActive: updated.enabled,
      blocked: false,
      preview: !apply,
      trialDebit: String(totals._sum.debit ?? 0),
      trialCredit: String(totals._sum.credit ?? 0),
      recipeReady: readiness.ready,
    };
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.blocked)
    throw Error(
      "Accounting remains off. Review the listed orders/recipes; nothing was force-closed.",
    );
  return result;
}

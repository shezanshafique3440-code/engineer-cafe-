/** Extra website and approval fixtures. Called only inside the captured seed transaction. */
import type { DB } from "@/server/business/core";
import type { SessionUser } from "@/lib/types";
import {
  procurementAction,
  stockCountAction,
  approvalAction,
} from "@/server/business/operations";
import { settleLoyalty } from "@/server/loyalty";
import { businessToday } from "@/lib/business-math";
export async function seedDemoExtras(tx: DB, actor: SessionUser) {
  const tag = "DEMO 2 · ";
  const [customers, products, suppliers, ingredients] = await Promise.all([
    tx.user.findMany({
      where: { id: { startsWith: "cafe-demo-v2-customer-user-" } },
      orderBy: { id: "asc" },
    }),
    tx.product.findMany({
      where: { id: { startsWith: "cafe-demo-v2-product-" } },
      orderBy: { id: "asc" },
    }),
    tx.businessParty.findMany({
      where: { id: { startsWith: "cafe-demo-v2-supplier-" } },
      orderBy: { id: "asc" },
    }),
    tx.ingredient.findMany({
      where: { id: { startsWith: "cafe-demo-v2-ingredient-" } },
      orderBy: { id: "asc" },
    }),
  ]);
  for (let n = 0; n < 30; n++)
    await tx.coupon.create({
      data: {
        id: `cafe-demo-v2-coupon-${n}`,
        code: `DEMO2-TEST-${n + 1}`,
        description: tag + "Inactive test coupon",
        discountType: n % 2 ? "PERCENTAGE" : "FIXED",
        discountValue: n % 2 ? 10 : 50,
        isActive: false,
      },
    });
  for (let n = 0; n < customers.length; n++) {
    const u = customers[n],
      product = products[n % products.length];
    await tx.address.create({
      data: {
        userId: u.id,
        label: "DEMO home",
        fullName: u.name,
        phone: "",
        addressLine: "DEMO address " + (n + 1),
        city: "Islamabad",
        notes: "Synthetic address. Never send a real delivery.",
      },
    });
    if (n < 48) {
      await tx.review.create({
        data: {
          productId: product.id,
          userId: u.id,
          rating: 3 + (n % 3),
          comment:
            tag +
            "Sample review for staff testing. Not a real customer review.",
          status: "PENDING",
        },
      });
      await tx.favorite.create({
        data: { userId: u.id, productId: product.id },
      });
      await seedDemoReward(tx, u.id);
    }
    if (n < 20)
      await tx.contactMessage.create({
        data: {
          id: `cafe-demo-v2-message-${n}`,
          name: u.name,
          email: u.email,
          subject: tag + "Test enquiry",
          message: "Synthetic enquiry for admin testing. No reply is required.",
          status: n % 3 === 0 ? "READ" : "NEW",
        },
      });
  }
  const addonGroup = await tx.addonGroup.create({
    data: {
      id: "cafe-demo-v2-addon-group",
      name: tag + "Training extras",
      slug: "demo2-training-extras",
      type: "MULTIPLE",
      maxSelect: 2,
    },
  });
  await tx.productAddon.createMany({
    data: [
      {
        id: "cafe-demo-v2-addon-1",
        addonGroupId: addonGroup.id,
        name: tag + "Extra topping",
        price: 50,
      },
      {
        id: "cafe-demo-v2-addon-2",
        addonGroupId: addonGroup.id,
        name: tag + "Extra portion",
        price: 100,
      },
    ],
  });
  await tx.addonGroupOnProduct.createMany({
    data: products
      .slice(0, 4)
      .map((p) => ({ productId: p.id, addonGroupId: addonGroup.id })),
  });
  for (let n = 0; n < 9; n++) {
    const ingredient = ingredients[n % ingredients.length];
    const po = await procurementAction(tx, actor, {
      action: "DRAFT",
      requestId: `demo2-po-${n}-unique-training`,
      supplierId: suppliers[n % suppliers.length].id,
      expectedOn: businessToday(),
      note: tag + "Training procurement",
      lines: [
        { ingredientId: ingredient.id, quantity: "100", totalCost: "200" },
      ],
    });
    if (n % 3 !== 0)
      await procurementAction(tx, actor, {
        action: n % 3 === 1 ? "APPROVE" : "CANCEL",
        requestId: `demo2-po-review-${n}`,
        id: po.id,
        version: po.updatedAt.toISOString(),
        note: tag + "Sample review",
      });
  }
  for (let n = 0; n < 6; n++) {
    const ingredient = await tx.ingredient.findUniqueOrThrow({
      where: { id: ingredients[n].id },
    });
    const count = await stockCountAction(tx, actor, {
      action: "DRAFT",
      requestId: `${n}-demo2-count-training`,
      date: businessToday(),
      note: tag + "Count example",
      lines: [
        {
          ingredientId: ingredient.id,
          version: ingredient.updatedAt.toISOString(),
          counted: String(ingredient.quantity),
        },
      ],
    });
    if (n % 3 !== 0)
      await stockCountAction(tx, actor, {
        action: n % 3 === 1 ? "POST" : "CANCEL",
        requestId: `demo2-count-review-${n}`,
        id: count.id,
        version: count.updatedAt.toISOString(),
        note: tag + "Sample review",
      });
  }
  const refund = await tx.order.findFirst({
    where: {
      id: { startsWith: "cafe-demo-v2-order-" },
      status: "CANCELLED",
      amountPaid: { gt: 100 },
      amountRefunded: 0,
    },
  });
  if (refund)
    for (let n = 0; n < 3; n++) {
      const approval = await approvalAction(tx, actor, {
        action: "REQUEST",
        requestId: `demo2-approval-${n}`,
        kind: "REFUND",
        orderId: refund.id,
        amount: "100",
        reason: tag + "Training refund approval",
      });
      if (n)
        await approvalAction(tx, actor, {
          action: "DECIDE",
          requestId: `demo2-approval-review-${n}`,
          id: approval.id,
          approved: n === 1,
          note: tag + "Sample owner decision",
        });
    }
}

/** Reward a real paid sample order for the same synthetic customer, so a later
 * cancellation follows the normal reversal path without inventing cross-user points. */
export async function seedDemoReward(tx: DB, userId: string) {
  if (!userId.startsWith("cafe-demo-v2-customer-user-"))
    throw Error("Synthetic customer required.");
  const order = await tx.order.findFirst({
    where: {
      id: { startsWith: "cafe-demo-v2-order-" },
      userId,
      status: "DELIVERED",
      paymentStatus: "PAID",
    },
    orderBy: { id: "asc" },
  });
  if (!order) return;
  const points = Math.floor(order.total / 100);
  if (!points) return;
  const updated = await tx.order.update({
    where: { id: order.id },
    data: { loyaltyPointsEarned: points },
  });
  await settleLoyalty(tx, updated, false);
}

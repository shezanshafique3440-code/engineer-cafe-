import "server-only";
import type { SessionUser } from "@/lib/types";
import type { DB } from "./core";
import { reviewer } from "./operations";
export async function operationsRead(
  tx: DB,
  actor: SessionUser,
  module: string,
) {
  if (module === "approvals")
    return {
      canReview: reviewer(actor),
      approvals: await tx.cafeApproval.findMany({
        where: reviewer(actor) ? {} : { requestedById: actor.id },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
    };
  if (module === "procurement")
    return {
      canReview: reviewer(actor),
      orders: await tx.cafePurchaseOrder.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      suppliers: await tx.businessParty.findMany({
        where: { kind: "SUPPLIER", isActive: true },
        orderBy: { name: "asc" },
      }),
      ingredients: await tx.ingredient.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
    };
  return {
    canReview: reviewer(actor),
    counts: await tx.cafeStockCount.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    ingredients: (
      await tx.ingredient.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      })
    ).map((i) => ({ ...i, version: i.updatedAt.toISOString() })),
  };
}

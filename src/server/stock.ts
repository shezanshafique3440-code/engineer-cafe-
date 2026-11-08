import "server-only";
import type { Prisma } from "@prisma/client";
import type { PricedLine } from "./pricing";
import { badRequest } from "./api";

export async function consumeStock(
  tx: Prisma.TransactionClient,
  orderId: string,
  lines: PricedLine[],
) {
  for (const line of lines) {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: line.productId },
      include: { recipe: { include: { item: true } } },
    });
    if (product.stock !== null) {
      const changed = await tx.product.updateMany({
        where: { id: product.id, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (!changed.count)
        throw badRequest(`Insufficient stock: ${product.name}.`);
    }
    await tx.product.update({
      where: { id: product.id },
      data: { soldCount: { increment: line.quantity } },
    });
    for (const recipe of product.recipe) {
      const quantity = Number(recipe.quantity) * line.quantity;
      const changed = await tx.inventoryItem.updateMany({
        where: {
          id: recipe.inventoryItemId,
          isActive: true,
          quantity: { gte: quantity },
        },
        data: { quantity: { decrement: quantity } },
      });
      if (!changed.count)
        throw badRequest(`Insufficient ingredient stock: ${recipe.item.name}.`);
      await tx.stockMovement.create({
        data: {
          inventoryItemId: recipe.inventoryItemId,
          quantity: -quantity,
          unitCost: recipe.item.averageCost,
          reason: "SALE",
          orderId,
        },
      });
    }
  }
}

export async function restoreStock(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (!item.productId) continue;
    const product = await tx.product.findUnique({
      where: { id: item.productId },
    });
    if (!product) continue;
    await tx.product.update({
      where: { id: product.id },
      data: {
        soldCount: Math.max(0, product.soldCount - item.quantity),
        ...(product.stock === null
          ? {}
          : { stock: { increment: item.quantity } }),
      },
    });
  }
  const movements = await tx.stockMovement.groupBy({
    by: ["inventoryItemId", "unitCost"],
    where: { orderId },
    _sum: { quantity: true },
  });
  for (const movement of movements) {
    if (Number(movement._sum.quantity) >= 0) continue;
    const item = await tx.inventoryItem.findUniqueOrThrow({
      where: { id: movement.inventoryItemId },
    });
    const restored = -Number(movement._sum.quantity);
    const nextQuantity = Number(item.quantity) + restored;
    const averageCost =
      Math.round(
        ((Number(item.quantity) * Number(item.averageCost) +
          restored * Number(movement.unitCost)) /
          nextQuantity) *
          10000,
      ) / 10000;
    await tx.inventoryItem.update({
      where: { id: movement.inventoryItemId },
      data: { quantity: { increment: restored }, averageCost },
    });
    await tx.stockMovement.create({
      data: {
        inventoryItemId: movement.inventoryItemId,
        orderId,
        quantity: -Number(movement._sum.quantity),
        unitCost: movement.unitCost,
        reason: "REVERSAL",
      },
    });
  }
}

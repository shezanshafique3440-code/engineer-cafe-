import "server-only";
import type { Order, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "./pricing";

/** Allocates the next EC#### order number inside the transaction. */
export async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const last = await tx.order.findFirst({
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true },
  });
  const lastSequence = last ? Number(last.orderNumber.replace(/\D/g, "")) - 1000 : -1;
  const sequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 0;

  // Guard against gaps/collisions from concurrent checkouts.
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = generateOrderNumber(sequence + attempt);
    const clash = await tx.order.findUnique({
      where: { orderNumber: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `EC${Date.now().toString().slice(-6)}`;
}

const orderInclude = {
  items: { include: { addons: true } },
  events: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

export type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function serializeOrder(order: FullOrder) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    orderType: order.orderType,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    addressLine: order.addressLine,
    area: order.area,
    city: order.city,
    instructions: order.instructions,
    subtotal: order.subtotal,
    discount: order.discount,
    deliveryFee: order.deliveryFee,
    tax: order.tax,
    total: order.total,
    couponCode: order.couponCode,
    estimatedMinutes: order.estimatedMinutes,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt.toISOString(),
    placedAt: order.placedAt.toISOString(),
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productSlug: item.productSlug,
      productImage: item.productImage,
      unitPrice: item.unitPrice,
      addonsTotal: item.addonsTotal,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      notes: item.notes,
      addons: item.addons.map((a) => ({
        id: a.id,
        addonId: a.addonId,
        groupName: a.groupName,
        addonName: a.addonName,
        price: a.price,
      })),
    })),
    events: order.events.map((e) => ({
      id: e.id,
      status: e.status,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export type OrderDTO = ReturnType<typeof serializeOrder>;

export function findOrder(where: Prisma.OrderWhereInput) {
  return prisma.order.findFirst({ where, include: orderInclude });
}

/** Applies a status change plus its side effects (timestamps, stock, event log). */
export async function transitionOrder(
  order: Order,
  status: OrderStatus,
  note?: string,
): Promise<FullOrder> {
  const data: Prisma.OrderUpdateInput = { status };
  const now = new Date();

  if (status === "CONFIRMED" && !order.confirmedAt) data.confirmedAt = now;
  if (status === "READY" && !order.readyAt) data.readyAt = now;
  if (status === "DELIVERED") {
    data.deliveredAt = now;
    if (order.paymentMethod !== "ONLINE") data.paymentStatus = "PAID";
  }
  if (status === "CANCELLED") {
    data.cancelReason = note || "Cancelled";
    if (order.paymentStatus === "PAID") data.paymentStatus = "REFUNDED";
  }

  return prisma.$transaction(async (tx) => {
    // Restock and roll back sales counters when an order is cancelled.
    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      const items = await tx.orderItem.findMany({
        where: { orderId: order.id, productId: { not: null } },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        if (!item.productId) continue;
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true, soldCount: true },
        });
        if (!product) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: product.stock === null ? null : product.stock + item.quantity,
            soldCount: Math.max(0, product.soldCount - item.quantity),
          },
        });
      }
      if (order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usageCount: { decrement: 1 } },
        });
      }
    }

    await tx.order.update({ where: { id: order.id }, data });
    await tx.orderEvent.create({
      data: { orderId: order.id, status, note: note || null },
    });
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  });
}

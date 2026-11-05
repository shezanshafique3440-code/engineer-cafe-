import "server-only";
import type { Order, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "./api";
import { generateOrderNumber } from "./pricing";

/** Allocates the next EC#### order number inside the transaction. */
export async function nextOrderNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  // Serialize allocation until commit so two checkouts cannot claim the same number.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(73019301)`;
  const last = await tx.order.findFirst({
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true },
  });
  const lastSequence = last
    ? Number(last.orderNumber.replace(/\D/g, "")) - 1000
    : -1;
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

export type FullOrder = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

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
    version: order.updatedAt.toISOString(),
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

/** Remove a confirmed snapshot once, releasing only unfinished reservations. */
export async function deleteOrder(
  id: string,
  confirmation: { orderNumber: string; version: string },
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id.toUpperCase() }] },
      include: { items: { select: { productId: true, quantity: true } } },
    });
    if (!order)
      throw new HttpError(
        404,
        "Order no longer exists. Refresh the order list.",
      );
    if (
      order.orderNumber !== confirmation.orderNumber ||
      order.updatedAt.toISOString() !== confirmation.version
    )
      throw new HttpError(
        409,
        "This order changed on another screen. Refresh and review it before deleting.",
      );

    // The delete predicate serializes deletion against another delete or status
    // transition. Cascades remove items, add-ons and timeline in this transaction.
    const removed = await tx.order.deleteMany({
      where: {
        id: order.id,
        orderNumber: confirmation.orderNumber,
        updatedAt: order.updatedAt,
      },
    });
    if (removed.count !== 1)
      throw new HttpError(
        409,
        "This order changed on another screen. Refresh and try again.",
      );

    // Delivered food was consumed; cancelled reservations were already released.
    if (order.status !== "DELIVERED" && order.status !== "CANCELLED") {
      for (const item of order.items) {
        if (!item.productId) continue;
        await tx.$executeRaw`UPDATE "Product" SET "stock" = "stock" + ${item.quantity},
          "soldCount" = GREATEST(0, "soldCount" - ${item.quantity}), "updatedAt" = NOW()
          WHERE "id" = ${item.productId}`;
      }
      if (order.couponId) {
        await tx.$executeRaw`UPDATE "Coupon" SET "usageCount" = GREATEST(0, "usageCount" - 1),
          "updatedAt" = NOW() WHERE "id" = ${order.couponId}`;
      }
    }
    return { id: order.id, orderNumber: order.orderNumber };
  });
}

/** Applies a status change plus its side effects (timestamps, stock, event log). */
export async function transitionOrder(
  order: Order,
  status: OrderStatus,
  note?: string,
): Promise<FullOrder> {
  if (order.status === "CANCELLED")
    throw new HttpError(400, "Cancelled orders cannot be reopened.");
  if (order.status === "DELIVERED" && status !== "CANCELLED")
    throw new HttpError(400, "Delivered orders cannot return to the kitchen.");
  if (order.status === status)
    throw new HttpError(400, "The order already has this status.");
  if (order.orderType === "PICKUP" && status === "OUT_FOR_DELIVERY")
    throw new HttpError(400, "Pickup orders cannot go out for delivery.");
  if (
    status === "DELIVERED" &&
    order.paymentMethod === "ONLINE" &&
    order.paymentStatus !== "PAID"
  )
    throw new HttpError(400, "Confirm online payment before handover.");
  const data: Prisma.OrderUpdateManyMutationInput = { status };
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
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status, updatedAt: order.updatedAt },
      data,
    });
    if (updated.count !== 1)
      throw new HttpError(
        409,
        "This order changed on another screen. Refresh and try again.",
      );
    // Restock and roll back sales counters when an order is cancelled.
    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      const items = await tx.orderItem.findMany({
        where: { orderId: order.id, productId: { not: null } },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        if (!item.productId) continue;
        // Arithmetic in SQL avoids lost stock changes while another order checks out.
        await tx.$executeRaw`UPDATE "Product" SET "stock" = "stock" + ${item.quantity},
          "soldCount" = GREATEST(0, "soldCount" - ${item.quantity}), "updatedAt" = NOW()
          WHERE "id" = ${item.productId}`;
      }
      if (order.couponId) {
        await tx.$executeRaw`UPDATE "Coupon" SET "usageCount" = GREATEST(0, "usageCount" - 1),
          "updatedAt" = NOW() WHERE "id" = ${order.couponId}`;
      }
    }

    await tx.orderEvent.create({
      data: { orderId: order.id, status, note: note || null },
    });
    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
  });
}

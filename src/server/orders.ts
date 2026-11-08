import "server-only";
import type { Order, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest } from "./api";
import { businessTransaction } from "./transaction";
import { restoreStock } from "./stock";

/** Allocates the next EC#### order number inside the transaction. */
export async function nextOrderNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const rows = await tx.$queryRaw<
    { next: number }[]
  >`SELECT COALESCE(MAX(NULLIF(regexp_replace("orderNumber", '[^0-9]', '', 'g'), '')::bigint), 999)::bigint + 1 AS next FROM "Order"`;
  return `EC${rows[0].next}`;
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
  return businessTransaction(async (tx) => {
    const current = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["PREPARING", "CANCELLED"],
      PREPARING: ["READY", "CANCELLED"],
      READY:
        current.orderType === "DELIVERY"
          ? ["OUT_FOR_DELIVERY", "CANCELLED"]
          : ["DELIVERED", "CANCELLED"],
      OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
      DELIVERED: ["CANCELLED"],
      CANCELLED: [],
    };
    if (!allowed[current.status].includes(status))
      throw badRequest(`Cannot move ${current.status} to ${status}.`);
    if (current.status !== order.status)
      throw badRequest("Order changed. Refresh before trying again.");
    if (status === "OUT_FOR_DELIVERY" && !current.riderId)
      throw badRequest("Assign a rider first.");
    if (status === "DELIVERED" && current.paymentStatus !== "PAID")
      throw badRequest("Record payment before completing the order.");
    if (status === "CANCELLED" && current.paymentStatus === "PAID")
      throw badRequest("Refund the payment before cancelling.");
    if (status === "CANCELLED" && current.commissionPaidAt)
      throw badRequest(
        "Settled rider commission must be reconciled before cancellation.",
      );
    const now = new Date();
    const data: Prisma.OrderUpdateInput = { status };
    if (status === "CONFIRMED") data.confirmedAt = now;
    if (status === "READY") data.readyAt = now;
    if (status === "DELIVERED") data.deliveredAt = now;
    if (status === "CANCELLED") {
      data.cancelReason = note || "Cancelled";
      data.commission = 0;
      await restoreStock(tx, current.id);
      if (current.couponId)
        await tx.coupon.updateMany({
          where: { id: current.couponId, usageCount: { gt: 0 } },
          data: { usageCount: { decrement: 1 } },
        });
    }
    await tx.order.update({ where: { id: current.id }, data });
    await tx.orderEvent.create({
      data: { orderId: current.id, status, note: note || null },
    });
    return tx.order.findUniqueOrThrow({
      where: { id: current.id },
      include: orderInclude,
    });
  });
}

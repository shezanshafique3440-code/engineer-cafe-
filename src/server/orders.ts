import "server-only";
import type { SessionUser } from "@/lib/types";
import { getCurrentUser } from "./auth";
import { audit, businessLock } from "./business/core";
import { consumeOrder } from "./business/inventory";
import {
  invoiceOrder,
  receiveOrderMoney,
  voidBusinessOrder,
} from "./business/order-ledger";
import { paise, decimal } from "@/lib/business-math";
import type { Order, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "./api";
import { settleLoyalty } from "./loyalty";

/** Allocates the next EC#### order number inside the transaction. */
export async function nextOrderNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  // Serialize allocation until commit so two checkouts cannot claim the same number.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(73019301)`;
  // Persistent counter prevents reuse after deletion of the newest receipt.
  const max = await tx.$queryRaw<
    { value: number }[]
  >`SELECT GREATEST(999, COALESCE(MAX(CASE WHEN "orderNumber" ~ '^EC[0-9]{1,9}$' THEN SUBSTRING("orderNumber" FROM 3)::INTEGER END),999))::INTEGER AS value FROM "Order"`;
  const counter = await tx.orderCounter.upsert({
    where: { id: 1 },
    create: { id: 1, value: max[0].value },
    update: {},
  });
  const next = Math.max(counter.value, max[0].value) + 1;
  await tx.orderCounter.update({ where: { id: 1 }, data: { value: next } });
  return `EC${next}`;
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
    channel: order.channel,
    scheduledAt: order.scheduledAt?.toISOString() ?? null,
    cashReceived:
      order.cashTendered !== null
        ? Number(order.cashTendered)
        : order.cashReceived,
    cashChange:
      order.changeGiven !== null ? Number(order.changeGiven) : order.cashChange,
    businessTracked: order.businessTracked,
    businessCredit: order.businessCredit,
    serviceMode: order.serviceMode,
    tableSessionId: order.tableSessionId,
    tableName: order.tableName,
    waiterName: order.waiterName,
    amountPaid: order.amountPaid.toString(),
    amountRefunded: order.amountRefunded.toString(),
    remainingDue: decimal(
      order.status === "CANCELLED"
        ? 0n
        : BigInt(order.total) * 100n -
            paise(order.amountPaid) +
            paise(order.amountRefunded),
    ),
    refundDue: decimal(
      order.status === "CANCELLED"
        ? paise(order.amountPaid) - paise(order.amountRefunded)
        : 0n,
    ),
    loyaltyPointsUsed: order.loyaltyPointsUsed,
    loyaltyDiscount: order.loyaltyDiscount,
    loyaltyPointsEarned: order.loyaltyPointsEarned,
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
    await businessLock(tx);
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

    if (order.businessTracked)
      throw new HttpError(
        409,
        "This order is part of the financial ledger. Cancel it and record any refund; it cannot be permanently deleted.",
      );
    // Match checkout lock order: customer before order/stock, avoiding a cancellation deadlock.
    if (order.userId)
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${order.userId} FOR UPDATE`;

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

    if (order.status !== "DELIVERED" && order.status !== "CANCELLED")
      await settleLoyalty(tx, order, true);
    // Delivered food was consumed; cancelled reservations were already released.
    if (order.status !== "DELIVERED" && order.status !== "CANCELLED") {
      for (const item of order.items) {
        if (!item.productId) continue;
        if (order.businessTracked && order.businessConsumedAt) {
          await tx.$executeRaw`UPDATE "Product" SET "soldCount" = GREATEST(0,"soldCount"-${item.quantity}), "updatedAt"=NOW() WHERE id=${item.productId}`;
        } else
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
  actorInput?: SessionUser,
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
  if (
    order.scheduledAt &&
    ["PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"].includes(status) &&
    order.scheduledAt.getTime() > Date.now() + order.estimatedMinutes * 60000
  )
    throw new HttpError(
      400,
      "Scheduled ticket is not due for preparation yet.",
    );
  const data: Prisma.OrderUpdateManyMutationInput = { status };
  const now = new Date();

  if (status === "CONFIRMED" && !order.confirmedAt) data.confirmedAt = now;
  if (status === "READY" && !order.readyAt) data.readyAt = now;
  if (status === "DELIVERED") {
    data.deliveredAt = now;
    if (!order.businessTracked && order.paymentMethod !== "ONLINE")
      data.paymentStatus = "PAID";
  }
  if (status === "CANCELLED") {
    data.cancelReason = note || "Cancelled";
    if (!order.businessTracked && order.paymentStatus === "PAID")
      data.paymentStatus = "REFUNDED";
  }

  const actor = actorInput ??
    (await getCurrentUser()) ?? {
      id: "system",
      name: "Cafe system",
      email: "",
      role: "ADMIN" as const,
    };
  return prisma.$transaction(
    async (tx) => {
      await businessLock(tx);
      if (order.userId)
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${order.userId} FOR UPDATE`;
      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          status: order.status,
          updatedAt: order.updatedAt,
        },
        data,
      });
      if (updated.count !== 1)
        throw new HttpError(
          409,
          "This order changed on another screen. Refresh and try again.",
        );
      if (order.businessTracked) {
        if (
          ["PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"].includes(
            status,
          )
        )
          await consumeOrder(tx, actor, order.id);
        if (status === "DELIVERED") {
          await invoiceOrder(tx, actor, order.id);
          const current = await tx.order.findUniqueOrThrow({
            where: { id: order.id },
          });
          const remaining =
            BigInt(current.total) * 100n -
            paise(current.amountPaid) +
            paise(current.amountRefunded);
          if (!current.businessCredit && remaining > 0n) {
            if (current.paymentMethod === "ONLINE")
              throw new HttpError(
                400,
                "Record the verified bank or wallet receipt before handover.",
              );
            await receiveOrderMoney(tx, actor, {
              orderId: current.id,
              amount: remaining,
              accountId:
                current.orderType === "DELIVERY" ? "RIDER_CASH" : "CASH_MAIN",
              requestId: "handover:" + current.id,
              note: "Cash collected at handover #" + current.orderNumber,
            });
          }
          if (current.total === 0)
            await tx.order.update({
              where: { id: current.id },
              data: { paymentStatus: "PAID" },
            });
        }
        if (status === "CANCELLED")
          await voidBusinessOrder(tx, actor, order, note || "Cancelled");
      }
      // Restock and roll back sales counters when an order is cancelled.
      if (status === "CANCELLED" && order.status !== "CANCELLED") {
        const items = await tx.orderItem.findMany({
          where: { orderId: order.id, productId: { not: null } },
          select: { productId: true, quantity: true },
        });
        for (const item of items) {
          if (!item.productId) continue;
          // Arithmetic in SQL avoids lost stock changes while another order checks out.
          if (order.businessTracked && order.businessConsumedAt) {
            await tx.$executeRaw`UPDATE "Product" SET "soldCount" = GREATEST(0,"soldCount"-${item.quantity}), "updatedAt"=NOW() WHERE id=${item.productId}`;
          } else
            await tx.$executeRaw`UPDATE "Product" SET "stock" = "stock" + ${item.quantity},
          "soldCount" = GREATEST(0, "soldCount" - ${item.quantity}), "updatedAt" = NOW()
          WHERE "id" = ${item.productId}`;
        }
        if (order.couponId) {
          await tx.$executeRaw`UPDATE "Coupon" SET "usageCount" = GREATEST(0, "usageCount" - 1),
          "updatedAt" = NOW() WHERE "id" = ${order.couponId}`;
        }
      }

      const finalState = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      if (
        status === "CANCELLED" ||
        (status === "DELIVERED" && finalState.paymentStatus === "PAID")
      )
        await settleLoyalty(tx, finalState, status === "CANCELLED");

      await tx.orderEvent.create({
        data: { orderId: order.id, status, note: note || null },
      });
      await audit(tx, actor, "UPDATE_ORDER_STATUS", "Order", order.id, {
        orderNumber: order.orderNumber,
        before: order.status,
        after: status,
        note: note || "",
      });
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
    },
    { timeout: 20000 },
  );
}

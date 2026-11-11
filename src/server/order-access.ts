import "server-only";
import { validTrackingToken } from "./order-tracking";
import { canBusiness, waiterOrderScope } from "@/lib/business-access";
import type { SessionUser } from "@/lib/types";
import { findOrder, type FullOrder } from "./orders";

export async function readableOrder(
  id: string,
  user: SessionUser | null,
  token: string | null,
) {
  const order = await findOrder({
    OR: [{ id }, { orderNumber: id.toUpperCase() }],
  });
  if (!order) return null;
  if (user && order.userId === user.id) return { order, private: true };
  if (canBusiness(user, "orders") && user) {
    const allowed = await findOrder({
      id: order.id,
      ...waiterOrderScope(user),
    });
    if (allowed) return { order, private: true };
  }
  return validTrackingToken(order, token) ? { order, private: false } : null;
}
/** Public receipt links show progress and purchased items, never customer/contact/internal data. */
export function trackingOrder(order: FullOrder) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    orderType: order.orderType,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    discount: order.discount,
    deliveryFee: order.deliveryFee,
    tax: order.tax,
    total: order.total,
    placedAt: order.placedAt.toISOString(),
    estimatedMinutes: order.estimatedMinutes,
    items: order.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    events: order.events.map((event) => ({
      status: event.status,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
export type PublicTrackingOrder = ReturnType<typeof trackingOrder>;

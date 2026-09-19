import type { OrderStatus, PaymentMethod, OrderType } from "@prisma/client";

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Order Placed",
  CONFIRMED: "Order Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
  CONFIRMED: "bg-sky-100 text-sky-800 ring-sky-200",
  PREPARING: "bg-violet-100 text-violet-800 ring-violet-200",
  READY: "bg-teal-100 text-teal-800 ring-teal-200",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH_ON_DELIVERY: "Cash on Delivery",
  CASH_AT_COUNTER: "Cash at Counter",
  ONLINE: "Online Payment",
};

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  DELIVERY: "Delivery",
  PICKUP: "Pickup",
};

/**
 * Every status an order could be set to, minus the one it is already on.
 *
 * The admin table offers all of them rather than only the next step forward:
 * a counter order is often already made and handed over by the time anyone
 * opens the panel, and stepping it through Confirmed, Preparing and Ready one
 * save at a time is busywork. Correcting a mistake backwards matters too.
 */
export function allStatuses(current: OrderStatus, orderType: OrderType): OrderStatus[] {
  return [...ORDER_STATUS_FLOW, "CANCELLED" as OrderStatus].filter(
    (status) =>
      status !== current &&
      // A pickup order never goes out for delivery.
      !(orderType === "PICKUP" && status === "OUT_FOR_DELIVERY"),
  );
}

/**
 * Just the next step forward, plus cancelling — the one-tap path used by the
 * buttons in the order detail modal.
 */
export function nextStatuses(current: OrderStatus, orderType: OrderType): OrderStatus[] {
  if (current === "DELIVERED" || current === "CANCELLED") return [];
  const flow = ORDER_STATUS_FLOW.filter((s) =>
    orderType === "PICKUP" ? s !== "OUT_FOR_DELIVERY" : true,
  );
  const index = flow.indexOf(current);
  const forward = index >= 0 && index < flow.length - 1 ? [flow[index + 1]] : [];
  return [...forward, "CANCELLED" as OrderStatus];
}

/** Playful engineering microcopy used across the site. */
export const ENGINEER_QUIPS = [
  "Debug your hunger.",
  "Compile your cravings.",
  "404: Chai Not Found.",
  "Low battery? Recharge with chai.",
  "Engineering problems need chai solutions.",
  "Coffee is optional. Chai is mandatory.",
  "git commit -m \"one more cup\"",
  "Runtime error: paratha not consumed.",
] as const;

export const SPICE_LABEL = {
  NONE: "Not spicy",
  MILD: "Mild",
  MEDIUM: "Medium spicy",
  HOT: "Hot",
} as const;

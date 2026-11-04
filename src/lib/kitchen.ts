import type { OrderStatus, OrderType } from "@prisma/client";

export const KITCHEN_LANES = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
] as const;
export function kitchenNext(
  status: OrderStatus,
  type: OrderType,
): OrderStatus | null {
  const flow: OrderStatus[] =
    type === "PICKUP"
      ? ["PENDING", "CONFIRMED", "PREPARING", "READY", "DELIVERED"]
      : [
          "PENDING",
          "CONFIRMED",
          "PREPARING",
          "READY",
          "OUT_FOR_DELIVERY",
          "DELIVERED",
        ];
  const index = flow.indexOf(status);
  return index >= 0 ? (flow[index + 1] ?? null) : null;
}
export function ticketAge(
  placedAt: string,
  estimatedMinutes: number,
  now = Date.now(),
) {
  const elapsed = Math.max(
    0,
    Math.floor((now - new Date(placedAt).getTime()) / 60_000),
  );
  const target = Math.max(1, estimatedMinutes);
  return {
    elapsed,
    remaining: Math.max(0, target - elapsed),
    overdue: elapsed > target,
    progress: Math.min(100, Math.round((elapsed / target) * 100)),
  };
}

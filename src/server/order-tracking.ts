import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type { FullOrder } from "./orders";
const LIFETIME = 30 * 24 * 60 * 60 * 1000;
/** A short-lived, order-specific capability. Knowing an EC number never grants access. */
export function trackingToken(order: Pick<FullOrder, "id" | "placedAt">) {
  const expires = String(order.placedAt.getTime() + LIFETIME);
  const signature = createHmac("sha256", env.authSecret)
    .update(`order-tracking:v1:${order.id}:${expires}`)
    .digest("base64url");
  return `${expires}.${signature}`;
}
export function validTrackingToken(
  order: Pick<FullOrder, "id" | "placedAt">,
  token: string | null,
) {
  if (
    !token ||
    token.length > 100 ||
    order.placedAt.getTime() + LIFETIME <= Date.now()
  )
    return false;
  const expected = Buffer.from(trackingToken(order));
  const supplied = Buffer.from(token);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}
export function trackingPath(order: Pick<FullOrder, "id" | "placedAt">) {
  return `/orders/${order.id}?tracking=${encodeURIComponent(trackingToken(order))}`;
}

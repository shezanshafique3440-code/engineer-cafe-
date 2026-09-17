import type { OrderStatus } from "@prisma/client";

/**
 * Order notifications, WhatsApp-first.
 *
 * The cafe has no SMS gateway and no WhatsApp Business API subscription, so
 * notifications are built as pre-written `wa.me` messages that staff send with
 * one tap from the admin panel. No paid integration, no delivery charges, and
 * the customer gets the update on the app they already use.
 *
 * Everything here is pure string work so it can run in a client component.
 */

/**
 * Normalises a Pakistani phone number into the digits-only form `wa.me`
 * expects (country code, no `+`, no separators).
 *
 *   "0300 1234567"    → "923001234567"
 *   "+92 300-1234567" → "923001234567"
 *   "3001234567"      → "923001234567"
 *
 * Returns null when the input cannot be a dialable number, so callers can hide
 * the button rather than opening a broken chat.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Local trunk prefix: 03001234567 → 923001234567
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  // Bare subscriber number: 3001234567 → 923001234567
  else if (digits.length === 10 && digits.startsWith("3")) digits = `92${digits}`;

  // Shortest real international number is 8 digits, longest is 15 (E.164).
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export type NotifiableOrder = {
  orderNumber: string;
  status: OrderStatus;
  orderType: "DELIVERY" | "PICKUP";
  customerName: string;
  customerPhone: string;
  total: number;
  estimatedMinutes: number;
  cancelReason?: string | null;
  items: { quantity: number; productName: string }[];
};

type MessageOptions = {
  cafeName: string;
  /** Formats an integer amount into the cafe's currency, e.g. "Rs. 450". */
  money: (amount: number) => string;
  /** Absolute origin used to build the tracking link, e.g. "https://…". */
  origin?: string;
  orderId?: string;
};

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || "ji";
}

/**
 * The message body for a given status. Written in the same Roman Urdu register
 * the rest of the storefront uses, because that is how the cafe actually talks
 * to its customers.
 */
export function orderStatusMessage(
  order: NotifiableOrder,
  status: OrderStatus,
  options: MessageOptions,
): string {
  const name = firstName(order.customerName);
  const ref = `#${order.orderNumber}`;
  const eta = order.estimatedMinutes;
  const isPickup = order.orderType === "PICKUP";

  const opening: Record<OrderStatus, string> = {
    PENDING: `Assalam-o-Alaikum ${name}! ${options.cafeName} se. Aap ka order ${ref} humein mil gaya hai — hum abhi confirm kar rahe hain.`,
    CONFIRMED: `${name}, aap ka order ${ref} confirm ho gaya hai. Taiyari shuru — andazan ${eta} minute.`,
    PREPARING: `${name}, order ${ref} abhi tawe par hai. Andazan ${eta} minute mein taiyar ho jayega.`,
    READY: isPickup
      ? `${name}, aap ka order ${ref} taiyar hai — counter se le lijiye. Chai garam hai!`
      : `${name}, aap ka order ${ref} taiyar hai aur bas nikalne wala hai.`,
    OUT_FOR_DELIVERY: `${name}, order ${ref} raste mein hai. Rider thori dair mein pohanch raha hai — phone paas rakhiye ga.`,
    DELIVERED: `${name}, order ${ref} pohanch gaya. Shukriya! Chai kaisi lagi? Agar waqt mile to website par review zaroor likhiye ga.`,
    CANCELLED: `${name}, maazrat — aap ka order ${ref} cancel karna para${
      order.cancelReason ? ` (${order.cancelReason})` : ""
    }. Koi masla ho to isi number par bataiye.`,
  };

  const lines = [opening[status]];

  // The order summary is useful while the order is still live; after delivery
  // or cancellation it is just noise.
  if (status !== "DELIVERED" && status !== "CANCELLED") {
    const summary = order.items
      .map((item) => `• ${item.quantity} × ${item.productName}`)
      .join("\n");
    lines.push("", summary, `Total: ${options.money(order.total)}`);
  }

  if (options.origin && options.orderId) {
    lines.push("", `Track: ${options.origin}/orders/${options.orderId}`);
  }

  lines.push("", `— ${options.cafeName}`);
  return lines.join("\n");
}

/**
 * A `wa.me` deep link that opens WhatsApp with the status message pre-typed.
 * Returns null when the customer's number is unusable.
 */
export function whatsappOrderHref(
  order: NotifiableOrder,
  status: OrderStatus,
  options: MessageOptions,
): string | null {
  const number = toWhatsAppNumber(order.customerPhone);
  if (!number) return null;
  const text = orderStatusMessage(order, status, options);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Short label for the notify button, so staff know what will be sent. */
export const NOTIFY_LABEL: Record<OrderStatus, string> = {
  PENDING: "Order received",
  CONFIRMED: "Order confirmed",
  PREPARING: "Now preparing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "On the way",
  DELIVERED: "Delivered — ask for a review",
  CANCELLED: "Cancelled",
};

import "server-only";
import type { CafeSetting, OrderType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest } from "./api";

export type QuoteLineInput = {
  productId: string;
  quantity: number;
  addonIds: string[];
  notes?: string;
};

export type PricedLine = {
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string | null;
  unitPrice: number;
  addons: { id: string; name: string; groupName: string; price: number }[];
  addonsTotal: number;
  quantity: number;
  lineTotal: number;
  notes?: string;
  prepTimeMinutes: number;
};

export type Quote = {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  itemCount: number;
  estimatedMinutes: number;
  coupon: { id: string; code: string; description: string | null; discount: number } | null;
  couponError: string | null;
  belowMinimum: boolean;
  minOrderAmount: number;
};

/**
 * The single source of truth for money. Every price, add-on price, discount,
 * delivery fee and tax is re-read from the database here — nothing from the
 * request body is trusted except product ids, add-on ids and quantities.
 */
export async function priceCart(
  input: {
    lines: QuoteLineInput[];
    couponCode?: string | null;
    orderType: OrderType;
    userId?: string | null;
  },
  settings: CafeSetting,
): Promise<Quote> {
  const productIds = [...new Set(input.lines.map((l) => l.productId))];

  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: {
          addonGroups: {
            include: { addonGroup: { include: { addons: true } } },
          },
        },
      })
    : [];

  const productMap = new Map(products.map((p) => [p.id, p]));
  const pricedLines: PricedLine[] = [];

  for (const line of input.lines) {
    const product = productMap.get(line.productId);
    if (!product) throw badRequest("One of the items in your cart is no longer on the menu.");
    if (!product.isAvailable) {
      throw badRequest(`"${product.name}" is currently unavailable.`);
    }
    if (product.stock !== null && product.stock < line.quantity) {
      throw badRequest(
        product.stock === 0
          ? `"${product.name}" is out of stock.`
          : `Only ${product.stock} left of "${product.name}".`,
      );
    }

    // Add-ons are only valid if they belong to a group attached to this product.
    const allowedAddons = new Map<string, { id: string; name: string; price: number; groupName: string; isAvailable: boolean }>();
    for (const link of product.addonGroups) {
      for (const addon of link.addonGroup.addons) {
        allowedAddons.set(addon.id, {
          id: addon.id,
          name: addon.name,
          price: addon.price,
          groupName: link.addonGroup.name,
          isAvailable: addon.isAvailable,
        });
      }
    }

    const chosen: PricedLine["addons"] = [];
    for (const addonId of [...new Set(line.addonIds)]) {
      const addon = allowedAddons.get(addonId);
      if (!addon) throw badRequest(`An option chosen for "${product.name}" is not available.`);
      if (!addon.isAvailable) throw badRequest(`"${addon.name}" is currently unavailable.`);
      chosen.push({ id: addon.id, name: addon.name, groupName: addon.groupName, price: addon.price });
    }

    // Enforce each group's selection rules (e.g. exactly one sugar level).
    for (const link of product.addonGroups) {
      const group = link.addonGroup;
      const count = chosen.filter((a) => a.groupName === group.name).length;
      if (group.isRequired && count < Math.max(1, group.minSelect)) {
        throw badRequest(`Please choose ${group.name.toLowerCase()} for "${product.name}".`);
      }
      if (group.type === "SINGLE" && count > 1) {
        throw badRequest(`Only one ${group.name.toLowerCase()} option can be chosen for "${product.name}".`);
      }
      if (group.maxSelect > 0 && count > group.maxSelect) {
        throw badRequest(`You can pick at most ${group.maxSelect} from ${group.name}.`);
      }
    }

    const unitPrice =
      product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price
        ? product.discountPrice
        : product.price;
    const addonsTotal = chosen.reduce((sum, a) => sum + a.price, 0);
    const lineTotal = (unitPrice + addonsTotal) * line.quantity;

    pricedLines.push({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.image,
      unitPrice,
      addons: chosen,
      addonsTotal,
      quantity: line.quantity,
      lineTotal,
      notes: line.notes,
      prepTimeMinutes: product.prepTimeMinutes,
    });
  }

  const subtotal = pricedLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const itemCount = pricedLines.reduce((sum, l) => sum + l.quantity, 0);

  const { discount, coupon, couponError } = await applyCoupon({
    code: input.couponCode ?? "",
    subtotal,
    userId: input.userId ?? null,
  });

  const discountedSubtotal = Math.max(0, subtotal - discount);

  let deliveryFee = 0;
  if (input.orderType === "DELIVERY" && subtotal > 0) {
    const qualifiesFree =
      settings.freeDeliveryOver !== null &&
      settings.freeDeliveryOver > 0 &&
      discountedSubtotal >= settings.freeDeliveryOver;
    deliveryFee = qualifiesFree ? 0 : settings.deliveryFee;
  }

  const tax = Math.round((discountedSubtotal * settings.taxPercent) / 100);
  const total = Math.max(0, discountedSubtotal + deliveryFee + tax);

  // Kitchen prep time: slowest item plus a small buffer per extra item.
  const slowest = pricedLines.reduce((max, l) => Math.max(max, l.prepTimeMinutes), 0);
  const estimatedMinutes = pricedLines.length
    ? Math.min(90, slowest + Math.max(0, itemCount - 1) * 2 + (input.orderType === "DELIVERY" ? 15 : 0))
    : 0;

  return {
    lines: pricedLines,
    subtotal,
    discount,
    deliveryFee,
    tax,
    total,
    itemCount,
    estimatedMinutes,
    coupon: coupon ? { ...coupon, discount } : null,
    couponError,
    belowMinimum: subtotal > 0 && subtotal < settings.minOrderAmount,
    minOrderAmount: settings.minOrderAmount,
  };
}

/**
 * Validates a coupon entirely server-side. A bad code never throws — it comes
 * back as `couponError` so the cart can still be priced without the discount.
 */
export async function applyCoupon(args: {
  code: string;
  subtotal: number;
  userId: string | null;
}): Promise<{
  discount: number;
  coupon: { id: string; code: string; description: string | null } | null;
  couponError: string | null;
}> {
  const code = args.code?.trim().toUpperCase();
  if (!code) return { discount: 0, coupon: null, couponError: null };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return { discount: 0, coupon: null, couponError: "That promo code doesn't exist." };
  if (!coupon.isActive)
    return { discount: 0, coupon: null, couponError: "This promo code is no longer active." };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now)
    return { discount: 0, coupon: null, couponError: "This promo code isn't active yet." };
  if (coupon.expiresAt && coupon.expiresAt < now)
    return { discount: 0, coupon: null, couponError: "This promo code has expired." };
  if (coupon.maxUsage !== null && coupon.usageCount >= coupon.maxUsage)
    return { discount: 0, coupon: null, couponError: "This promo code has reached its limit." };
  if (args.subtotal < coupon.minOrderAmount)
    return {
      discount: 0,
      coupon: null,
      couponError: `Add Rs. ${(coupon.minOrderAmount - args.subtotal).toLocaleString("en-PK")} more to use this code.`,
    };

  if (coupon.perUserLimit !== null && coupon.perUserLimit > 0) {
    if (!args.userId) {
      return { discount: 0, coupon: null, couponError: "Please login to use this promo code." };
    }
    const used = await prisma.order.count({
      where: { couponId: coupon.id, userId: args.userId, status: { not: "CANCELLED" } },
    });
    if (used >= coupon.perUserLimit)
      return { discount: 0, coupon: null, couponError: "You've already used this promo code." };
  }

  let discount =
    coupon.discountType === "PERCENTAGE"
      ? Math.round((args.subtotal * coupon.discountValue) / 100)
      : coupon.discountValue;

  if (coupon.maxDiscount !== null && coupon.maxDiscount > 0) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  discount = Math.min(discount, args.subtotal);

  return {
    discount,
    coupon: { id: coupon.id, code: coupon.code, description: coupon.description },
    couponError: null,
  };
}

/** EC1024-style human-friendly order numbers. */
export function generateOrderNumber(sequence: number): string {
  return `EC${String(1000 + sequence).padStart(4, "0")}`;
}

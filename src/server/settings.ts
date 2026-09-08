import "server-only";
import type { CafeSetting } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

/**
 * Cafe settings live in a single row so the admin can change delivery fees,
 * tax, contact details and payment methods without a redeploy. The row is
 * created on first read.
 */
export async function getSettings(): Promise<CafeSetting> {
  const existing = await prisma.cafeSetting.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.cafeSetting.create({
    data: { id: 1, whatsapp: env.whatsappFallback },
  });
}

/** Only the fields that are safe to expose to the browser. */
export function publicSettings(settings: CafeSetting) {
  return {
    cafeName: settings.cafeName,
    tagline: settings.tagline,
    logoUrl: settings.logoUrl,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    email: settings.email,
    address: settings.address,
    city: settings.city,
    mapsQuery: settings.mapsQuery,
    openingHours: settings.openingHours,
    deliveryFee: settings.deliveryFee,
    freeDeliveryOver: settings.freeDeliveryOver,
    minOrderAmount: settings.minOrderAmount,
    taxPercent: settings.taxPercent,
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    instagramUrl: settings.instagramUrl,
    facebookUrl: settings.facebookUrl,
    tiktokUrl: settings.tiktokUrl,
    codEnabled: settings.codEnabled,
    cashAtCounterEnabled: settings.cashAtCounterEnabled,
    onlinePaymentEnabled: settings.onlinePaymentEnabled,
    isAcceptingOrders: settings.isAcceptingOrders,
  };
}

export type PublicSettings = ReturnType<typeof publicSettings>;

import "server-only";
import { createHash } from "node:crypto";
import type { CheckoutInput } from "@/lib/validation";
import type { SessionUser } from "@/lib/types";
import type { CafeSetting } from "@prisma/client";
import { badRequest, HttpError } from "./api";
import { scheduleError } from "@/lib/experience";
import { priceCart } from "./pricing";
import { nextOrderNumber } from "./orders";
import { prisma } from "@/lib/prisma";
export async function createCafeOrder(
  data: CheckoutInput,
  user: SessionUser | null,
  settings: CafeSetting,
  pos?: { cashReceived: number },
) {
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ data, pos }))
    .digest("hex");
  const requestKey = data.requestId
    ? `${pos ? "POS" : "WEB"}:${data.requestId}`
    : null;
  if (requestKey) {
    const previous = await prisma.order.findUnique({
      where: { requestKey },
      include: {
        items: { include: { addons: true } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (previous) {
      if (
        previous.requestHash !== requestHash ||
        previous.userId !== (user?.id ?? null)
      )
        throw new HttpError(
          409,
          "This checkout request was already used. Start a new order.",
        );
      return previous;
    }
  }
  if (!pos && !settings.isAcceptingOrders) {
    throw badRequest(
      "We're not taking orders right now. Please try again shortly.",
    );
  }

  const methodEnabled = {
    CASH_ON_DELIVERY: settings.codEnabled,
    CASH_AT_COUNTER: settings.cashAtCounterEnabled,
    ONLINE: settings.onlinePaymentEnabled,
  }[data.paymentMethod];
  if (!methodEnabled)
    throw badRequest("That payment method isn't available right now.");
  if (
    data.orderType === "PICKUP" &&
    data.paymentMethod === "CASH_ON_DELIVERY"
  ) {
    throw badRequest("Choose Cash at Counter for pickup orders.");
  }

  const quote = await priceCart(
    {
      lines: data.lines,
      couponCode: data.couponCode || null,
      orderType: data.orderType,
      userId: user?.id ?? null,
      redeemReward: data.redeemReward,
    },
    settings,
  );

  if (data.expectedTotal !== undefined && data.expectedTotal !== quote.total)
    throw new HttpError(
      409,
      "Your cart price changed. Refresh your cart before ordering.",
    );
  if (quote.lines.length === 0) throw badRequest("Your cart is empty.");
  if (!pos && quote.belowMinimum) {
    throw badRequest(
      `Minimum order is Rs. ${settings.minOrderAmount.toLocaleString("en-PK")}. Add a little more to your cart.`,
    );
  }
  // A coupon typed by the customer that turns out to be invalid must not
  // silently fall through as a full-price order.
  if (data.couponCode && quote.couponError) throw badRequest(quote.couponError);

  // Customer checkout is an order request, not proof that counter cash was received.
  // Only a staff completion action may mark a cash order as paid.

  const invalidTime = scheduleError(data.scheduledAt, settings);
  if (invalidTime) throw badRequest(invalidTime);
  const expectedTotal = quote.total;
  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx);
    if (requestKey) {
      const existing = await tx.order.findUnique({
        where: { requestKey },
        include: {
          items: { include: { addons: true } },
          events: { orderBy: { createdAt: "asc" } },
        },
      });
      if (existing) {
        if (
          existing.requestHash !== requestHash ||
          existing.userId !== (user?.id ?? null)
        )
          throw new HttpError(
            409,
            "This checkout request was already used. Start a new order.",
          );
        return existing;
      }
    }
    if (user) {
      const active = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "User" WHERE id = ${user.id} AND "isActive" = true FOR UPDATE`;
      if (!active.length)
        throw badRequest("Your account is unavailable. Please login again.");
    }
    const currentSettings = await tx.cafeSetting.findUniqueOrThrow({
      where: { id: 1 },
    });
    if (!pos && !currentSettings.isAcceptingOrders)
      throw badRequest("We're not taking orders right now.");
    const enabled = {
      CASH_ON_DELIVERY: currentSettings.codEnabled,
      CASH_AT_COUNTER: currentSettings.cashAtCounterEnabled,
      ONLINE: currentSettings.onlinePaymentEnabled,
    }[data.paymentMethod];
    if (!enabled)
      throw badRequest("That payment method is no longer available.");
    const timeError = scheduleError(data.scheduledAt, currentSettings);
    if (timeError) throw badRequest(timeError);
    const quote = await priceCart(
      {
        lines: data.lines,
        couponCode: data.couponCode || null,
        orderType: data.orderType,
        userId: user?.id ?? null,
        redeemReward: data.redeemReward,
      },
      currentSettings,
      tx,
    );
    if (!pos && quote.belowMinimum)
      throw badRequest("The minimum order amount changed. Review your cart.");
    if (data.couponCode && quote.couponError)
      throw badRequest(quote.couponError);
    if (quote.total !== expectedTotal)
      throw badRequest(
        "Your cart price changed. Refresh your cart before ordering.",
      );

    if (
      pos &&
      (pos.cashReceived < quote.total ||
        !Number.isSafeInteger(pos.cashReceived))
    )
      throw badRequest("Cash received must cover the full total.");
    const created = await tx.order.create({
      data: {
        orderNumber,
        requestKey,
        requestHash,
        channel: pos ? "POS" : "WEB",
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        cashReceived: pos?.cashReceived ?? null,
        cashChange: pos ? pos.cashReceived - quote.total : null,
        loyaltyDiscount: quote.loyaltyDiscount,
        loyaltyPointsUsed: quote.loyaltyPointsUsed,
        loyaltyPointsEarned: quote.loyaltyPointsEarned,
        userId: user?.id ?? null,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || user?.email || null,
        orderType: data.orderType,
        status: pos ? "CONFIRMED" : "PENDING",
        paymentMethod: data.paymentMethod,
        paymentStatus: pos ? "PAID" : "UNPAID",
        addressLine:
          data.orderType === "DELIVERY" ? data.addressLine || null : null,
        area: data.orderType === "DELIVERY" ? data.area || null : null,
        city: data.orderType === "DELIVERY" ? data.city || null : settings.city,
        instructions: data.instructions || null,
        subtotal: quote.subtotal,
        discount: quote.discount + quote.loyaltyDiscount,
        deliveryFee: quote.deliveryFee,
        tax: quote.tax,
        total: quote.total,
        couponId: quote.coupon
          ? ((
              await tx.coupon.findUnique({
                where: { code: quote.coupon.code },
                select: { id: true },
              })
            )?.id ?? null)
          : null,
        couponCode: quote.coupon?.code ?? null,
        estimatedMinutes: quote.estimatedMinutes,
        items: {
          create: quote.lines.map((line) => ({
            productId: line.productId,
            productName: line.productName,
            productSlug: line.productSlug,
            productImage: line.productImage,
            unitPrice: line.unitPrice,
            addonsTotal: line.addonsTotal,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
            notes: line.notes || null,
            addons: {
              create: line.addons.map((addon) => ({
                addonId: addon.id,
                groupName: addon.groupName,
                addonName: addon.name,
                price: addon.price,
              })),
            },
          })),
        },
        events: {
          create: [
            {
              status: pos ? "CONFIRMED" : "PENDING",
              note: pos ? "Counter sale: cash received" : "Order placed",
            },
          ],
        },
      },
      include: {
        items: { include: { addons: true } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });

    if (user && quote.loyaltyPointsUsed)
      await tx.loyaltyEntry.create({
        data: {
          userId: user.id,
          orderKey: created.id,
          kind: "REDEEM",
          points: -quote.loyaltyPointsUsed,
        },
      });
    if (!pos)
      await tx.notificationJob.create({
        data: {
          eventKey: `order:${created.id}`,
          title: `New order #${created.orderNumber}`,
          body: `${created.items.reduce((n, l) => n + l.quantity, 0)} items · Rs. ${created.total}${created.scheduledAt ? " · Scheduled" : ""}`,
          url: "/admin/orders",
        },
      });
    // Stock + sales counters.
    for (const line of quote.lines) {
      const reserved = await tx.product.updateMany({
        where: {
          id: line.productId,
          isAvailable: true,
          category: { isActive: true },
          OR: [{ stock: null }, { stock: { gte: line.quantity } }],
        },
        data: {
          soldCount: { increment: line.quantity },
          stock: { decrement: line.quantity },
        },
      });
      if (reserved.count !== 1)
        throw badRequest(
          `${line.productName} changed availability. Review your cart.`,
        );
    }

    if (quote.coupon) {
      await tx.coupon.update({
        where: { code: quote.coupon.code },
        data: { usageCount: { increment: 1 } },
      });
    }

    if (
      user &&
      data.saveAddress &&
      data.orderType === "DELIVERY" &&
      data.addressLine
    ) {
      const existing = await tx.address.count({ where: { userId: user.id } });
      await tx.address.create({
        data: {
          userId: user.id,
          label: "Saved at checkout",
          fullName: data.customerName,
          phone: data.customerPhone,
          addressLine: data.addressLine,
          area: data.area || null,
          city: data.city || settings.city,
          isDefault: existing === 0,
        },
      });
    }

    return created;
  });

  return order;
}

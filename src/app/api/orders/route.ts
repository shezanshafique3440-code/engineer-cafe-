import { checkoutSchema } from "@/lib/validation";
import { handle, json, parseBody, requireUser, badRequest } from "@/server/api";
import { getCurrentUser } from "@/server/auth";
import { priceCart } from "@/server/pricing";
import { getSettings } from "@/server/settings";
import { nextOrderNumber, serializeOrder } from "@/server/orders";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/server/rate-limit";

/** Orders belonging to the signed-in customer. */
export const GET = handle(async () => {
  const user = await requireUser();
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: { include: { addons: true } }, events: { orderBy: { createdAt: "asc" } } },
  });
  return json({ orders: orders.map(serializeOrder) });
});

/**
 * Creates an order. Every monetary figure is recalculated here from the
 * database — the client's totals are ignored entirely.
 */
export const POST = handle(async (request: Request) => {
  rateLimit(request, "checkout", 10, 60_000);
  const data = await parseBody(request, checkoutSchema);
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  if (!settings.isAcceptingOrders) {
    throw badRequest("We're not taking orders right now. Please try again shortly.");
  }

  const methodEnabled = {
    CASH_ON_DELIVERY: settings.codEnabled,
    CASH_AT_COUNTER: settings.cashAtCounterEnabled,
    ONLINE: settings.onlinePaymentEnabled,
  }[data.paymentMethod];
  if (!methodEnabled) throw badRequest("That payment method isn't available right now.");
  if (data.orderType === "PICKUP" && data.paymentMethod === "CASH_ON_DELIVERY") {
    throw badRequest("Choose Cash at Counter for pickup orders.");
  }

  const quote = await priceCart(
    {
      lines: data.lines,
      couponCode: data.couponCode || null,
      orderType: data.orderType,
      userId: user?.id ?? null,
    },
    settings,
  );

  if (quote.lines.length === 0) throw badRequest("Your cart is empty.");
  if (quote.belowMinimum) {
    throw badRequest(
      `Minimum order is Rs. ${settings.minOrderAmount.toLocaleString("en-PK")}. Add a little more to your cart.`,
    );
  }
  // A coupon typed by the customer that turns out to be invalid must not
  // silently fall through as a full-price order.
  if (data.couponCode && quote.couponError) throw badRequest(quote.couponError);

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx);

    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: user?.id ?? null,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || user?.email || null,
        orderType: data.orderType,
        status: "PENDING",
        paymentMethod: data.paymentMethod,
        paymentStatus: "UNPAID",
        addressLine: data.orderType === "DELIVERY" ? data.addressLine || null : null,
        area: data.orderType === "DELIVERY" ? data.area || null : null,
        city: data.orderType === "DELIVERY" ? data.city || null : settings.city,
        instructions: data.instructions || null,
        subtotal: quote.subtotal,
        discount: quote.discount,
        deliveryFee: quote.deliveryFee,
        tax: quote.tax,
        total: quote.total,
        couponId: quote.coupon ? (await tx.coupon.findUnique({ where: { code: quote.coupon.code }, select: { id: true } }))?.id ?? null : null,
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
        events: { create: [{ status: "PENDING", note: "Order placed" }] },
      },
      include: { items: { include: { addons: true } }, events: { orderBy: { createdAt: "asc" } } },
    });

    // Stock + sales counters.
    for (const line of quote.lines) {
      const product = await tx.product.findUnique({
        where: { id: line.productId },
        select: { stock: true },
      });
      await tx.product.update({
        where: { id: line.productId },
        data: {
          soldCount: { increment: line.quantity },
          ...(product?.stock !== null && product?.stock !== undefined
            ? { stock: Math.max(0, product.stock - line.quantity) }
            : {}),
        },
      });
    }

    if (quote.coupon) {
      await tx.coupon.update({
        where: { code: quote.coupon.code },
        data: { usageCount: { increment: 1 } },
      });
    }

    if (user && data.saveAddress && data.orderType === "DELIVERY" && data.addressLine) {
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

  return json({ order: serializeOrder(order) }, 201);
});

export const dynamic = "force-dynamic";

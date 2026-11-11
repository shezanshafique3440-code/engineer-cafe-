import "server-only";
import type { SessionUser } from "@/lib/types";
import { canBusiness, waiterOrderScope } from "@/lib/business-access";
import { badRequest, forbidden, HttpError } from "./api";
import { businessTx, audit, hash } from "./business/core";
import { reserveOrder } from "./business/inventory";
import { priceCart, type QuoteLineInput, type Quote } from "./pricing";
import { findOrder, serializeOrder } from "./orders";
class Preview extends Error {
  constructor(readonly quote: Quote) {
    super("preview");
  }
}
type Input = {
  requestId: string;
  version: string;
  preview: boolean;
  expectedTotal?: number;
  lines: QuoteLineInput[];
};
/** Edit only unprepared, unpaid tickets; committed financial/food history remains immutable. */
export async function editOrder(id: string, actor: SessionUser, data: Input) {
  if (!canBusiness(actor, "orders") || !canBusiness(actor, "payments"))
    throw forbidden("A cashier or owner must edit a bill.");
  try {
    const result = await businessTx(async (tx) => {
      const key = `edit-order:${actor.id}:${data.requestId}`;
      const payloadHash = hash({ id, ...data });
      if (!data.preview) {
        const prior = await tx.businessRequest.findUnique({ where: { key } });
        if (prior) {
          if (prior.payloadHash !== payloadHash)
            throw new HttpError(
              409,
              "This edit ID was already used for different details.",
            );
          return prior.result as { orderId: string };
        }
      }
      const order = await tx.order.findFirst({
        where: {
          ...waiterOrderScope(actor),
          OR: [{ id }, { orderNumber: id.toUpperCase() }],
        },
        include: { items: { include: { addons: true } } },
      });
      if (!order) throw new HttpError(404, "Order not found.");
      if (order.updatedAt.toISOString() !== data.version)
        throw new HttpError(409, "This bill changed. Refresh before editing.");
      if (
        !["PENDING", "CONFIRMED"].includes(order.status) ||
        order.paymentStatus !== "UNPAID" ||
        Number(order.amountPaid) !== 0 ||
        Number(order.amountRefunded) !== 0 ||
        order.businessConsumedAt ||
        order.businessInvoicedAt ||
        order.businessCredit ||
        order.discount ||
        order.couponId ||
        order.loyaltyPointsUsed
      )
        throw badRequest(
          "Only unpaid, unprepared tickets without credit, coupons or loyalty discounts can be edited. Cancel and reconcile paid/prepared bills instead.",
        );
      // Give this ticket's unconsumed product reservation back while re-pricing.
      for (const item of order.items)
        if (item.productId)
          await tx.$executeRaw`UPDATE "Product" SET stock=stock+${item.quantity}, "soldCount"=GREATEST(0,"soldCount"-${item.quantity}) WHERE id=${item.productId}`;
      const settings = await tx.cafeSetting.findUniqueOrThrow({
        where: { id: 1 },
      });
      const quote = await priceCart(
        { lines: data.lines, orderType: order.orderType, userId: order.userId },
        settings,
        tx,
      );
      if (quote.belowMinimum && order.channel === "WEB")
        throw badRequest("The revised bill is below the minimum order amount.");
      if (data.preview) throw new Preview(quote); // roll back the preview, including temporary stock restoration
      if (data.expectedTotal !== quote.total)
        throw new HttpError(
          409,
          "Prices changed. Preview the bill again before saving.",
        );
      if (
        await tx.ingredientReservation.count({
          where: { orderId: order.id, consumedAt: { not: null } },
        })
      )
        throw badRequest(
          "Food preparation already started; this ticket cannot be edited.",
        );
      await tx.ingredientReservation.updateMany({
        where: { orderId: order.id, consumedAt: null, releasedAt: null },
        data: { releasedAt: new Date() },
      });
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal: quote.subtotal,
          discount: quote.discount,
          deliveryFee: quote.deliveryFee,
          tax: quote.tax,
          total: quote.total,
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
                create: line.addons.map((a) => ({
                  addonId: a.id,
                  groupName: a.groupName,
                  addonName: a.name,
                  price: a.price,
                })),
              },
            })),
          },
          events: {
            create: {
              status: order.status,
              note: "Unpaid bill edited; prices and stock rechecked.",
            },
          },
        },
      });
      for (const line of quote.lines) {
        const updated = await tx.product.updateMany({
          where: {
            id: line.productId,
            OR: [{ stock: null }, { stock: { gte: line.quantity } }],
          },
          data: {
            stock: { decrement: line.quantity },
            soldCount: { increment: line.quantity },
          },
        });
        if (updated.count !== 1)
          throw badRequest("Stock changed. Preview this bill again.");
      }
      await reserveOrder(tx, order.id);
      await audit(tx, actor, "EDIT_UNPAID_ORDER", "Order", order.id, {
        beforeTotal: order.total,
        afterTotal: quote.total,
        beforeItems: order.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          notes: i.notes,
        })),
        afterItems: data.lines,
      });
      await tx.businessRequest.create({
        data: { key, payloadHash, result: { orderId: order.id } },
      });
      return { orderId: order.id };
    });
    const order = await findOrder({ id: result.orderId });
    if (!order) throw new HttpError(404, "Order not found.");
    return { order: serializeOrder(order) };
  } catch (error) {
    if (error instanceof Preview) return { quote: error.quote };
    throw error;
  }
}

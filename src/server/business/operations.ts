import "server-only";
import type { z } from "zod";
import type { SessionUser } from "@/lib/types";
import { canBusiness } from "@/lib/business-access";
import {
  businessToday,
  dateValue,
  decimal,
  paise,
  quantity,
} from "@/lib/business-math";
import { badRequest, forbidden } from "@/server/api";
import { audit, hash, versionCheck, type DB } from "./core";
import { schemas } from "./validation";
import { postPurchase } from "./purchases";
import { adjustIngredient } from "./inventory";
import { priceCart, type Quote, type QuoteLineInput } from "@/server/pricing";

export function reviewer(actor: SessionUser) {
  return actor.role === "ADMIN" || actor.businessProfile === "MANAGER";
}
function pastDate(date: string) {
  if (dateValue(date) > dateValue(businessToday()))
    throw badRequest("Future financial records cannot be posted.");
}
export async function procurementAction(
  tx: DB,
  actor: SessionUser,
  d: z.infer<typeof schemas.procurement>,
) {
  if (d.action === "DRAFT") {
    const supplier = await tx.businessParty.findUniqueOrThrow({
      where: { id: d.supplierId },
    });
    if (supplier.kind !== "SUPPLIER" || !supplier.isActive)
      throw badRequest("Choose an active supplier.");
    const ids = d.lines.map((l) => l.ingredientId);
    if (new Set(ids).size !== ids.length)
      throw badRequest("Combine duplicate ingredient lines.");
    const ingredients = await tx.ingredient.findMany({
      where: { id: { in: ids }, isActive: true },
    });
    if (ingredients.length !== ids.length)
      throw badRequest("An ingredient is inactive or missing.");
    const total = d.lines.reduce((sum, l) => sum + paise(l.totalCost), 0n);
    if (total <= 0n) throw badRequest("Purchase order needs a positive total.");
    const po = await tx.cafePurchaseOrder.create({
      data: {
        reference: "PO-" + d.requestId.slice(0, 12).toUpperCase(),
        supplierId: supplier.id,
        supplierName: supplier.name,
        expectedOn: dateValue(d.expectedOn),
        note: d.note,
        total: decimal(total),
        createdById: actor.id,
        createdByName: actor.name,
        lines: d.lines.map((l) => ({
          ...l,
          name: ingredients.find((i) => i.id === l.ingredientId)!.name,
          unit: ingredients.find((i) => i.id === l.ingredientId)!.unit,
        })),
      },
    });
    await audit(tx, actor, "DRAFT_PURCHASE_ORDER", "PurchaseOrder", po.id, {
      reference: po.reference,
      total: decimal(total),
    });
    return po;
  }
  const po = await tx.cafePurchaseOrder.findUniqueOrThrow({
    where: { id: d.id },
  });
  await versionCheck(d.version, po.updatedAt);
  if (["RECEIVED", "CANCELLED"].includes(po.status))
    throw badRequest("This purchase order is already completed.");
  if (d.action === "RECEIVE") {
    if (po.status !== "APPROVED")
      throw badRequest("Approve the purchase order before receiving it.");
    pastDate(d.date);
    const lines = schemas.purchases.options[0].shape.lines.parse(po.lines);
    const invoice = await postPurchase(tx, actor, {
      ...d,
      supplierId: po.supplierId,
      lines,
    });
    const updated = await tx.cafePurchaseOrder.update({
      where: { id: po.id },
      data: { status: "RECEIVED", purchaseId: invoice.id },
    });
    await audit(tx, actor, "RECEIVE_PURCHASE_ORDER", "PurchaseOrder", po.id, {
      purchaseId: invoice.id,
      invoice: d.invoiceNumber,
      note: d.note,
    });
    return updated;
  }
  if (!reviewer(actor)) throw forbidden("Manager or owner review required.");
  if (d.action === "APPROVE" && po.status !== "DRAFT")
    throw badRequest("Only draft purchase orders can be approved.");
  const updated = await tx.cafePurchaseOrder.update({
    where: { id: po.id },
    data:
      d.action === "APPROVE"
        ? {
            status: "APPROVED",
            approvedById: actor.id,
            approvedByName: actor.name,
            approvedAt: new Date(),
          }
        : { status: "CANCELLED" },
  });
  await audit(tx, actor, d.action + "_PURCHASE_ORDER", "PurchaseOrder", po.id, {
    note: d.note,
  });
  return updated;
}

const countSnapshot = schemas.stockcounts.options[0].shape.lines.element.extend(
  {
    name: schemas.suppliers.shape.name,
    unit: schemas.ingredients.options[0].shape.unit,
    expected: schemas.stockcounts.options[0].shape.lines.element.shape.counted,
    stockValue: schemas.payments.shape.amount,
  },
);
export async function stockCountAction(
  tx: DB,
  actor: SessionUser,
  d: z.infer<typeof schemas.stockcounts>,
) {
  if (d.action === "DRAFT") {
    pastDate(d.date);
    if (new Set(d.lines.map((l) => l.ingredientId)).size !== d.lines.length)
      throw badRequest("Each ingredient may appear only once.");
    const lines = [];
    for (const line of d.lines) {
      const item = await tx.ingredient.findUniqueOrThrow({
        where: { id: line.ingredientId },
      });
      if (!item.isActive) throw badRequest("An ingredient is inactive.");
      await versionCheck(line.version, item.updatedAt);
      if (
        quantity(line.counted) > quantity(item.quantity) &&
        line.addedValue === undefined
      )
        throw badRequest("Enter the value of extra stock for " + item.name);
      lines.push({
        ...line,
        name: item.name,
        unit: item.unit,
        expected: String(item.quantity),
        stockValue: String(item.stockValue),
      });
    }
    const count = await tx.cafeStockCount.create({
      data: {
        reference: "COUNT-" + d.requestId.slice(0, 12).toUpperCase(),
        date: dateValue(d.date),
        note: d.note,
        lines,
        createdById: actor.id,
        createdByName: actor.name,
      },
    });
    await audit(tx, actor, "DRAFT_STOCK_COUNT", "StockCount", count.id, {
      lines: lines.length,
      note: d.note,
    });
    return count;
  }
  const count = await tx.cafeStockCount.findUniqueOrThrow({
    where: { id: d.id },
  });
  await versionCheck(d.version, count.updatedAt);
  if (count.status !== "DRAFT")
    throw badRequest("Stock count is already completed.");
  if (d.action === "POST") {
    if (!reviewer(actor))
      throw forbidden("Manager or owner must post a stock count.");
    const lines = countSnapshot.array().parse(count.lines);
    // Verify every snapshot before adjusting anything. Outer transaction is atomic.
    for (const line of lines) {
      const item = await tx.ingredient.findUniqueOrThrow({
        where: { id: line.ingredientId },
      });
      await versionCheck(line.version, item.updatedAt);
    }
    for (const line of lines) {
      if (quantity(line.counted) === quantity(line.expected)) continue;
      await adjustIngredient(tx, actor, {
        requestId: d.requestId + ":" + line.ingredientId,
        ingredientId: line.ingredientId,
        kind: "COUNT",
        quantity: line.counted,
        value: line.addedValue,
        date: count.date.toISOString().slice(0, 10),
        note: count.reference + ": " + d.note,
      });
    }
  }
  const updated = await tx.cafeStockCount.update({
    where: { id: count.id },
    data: {
      status: d.action === "POST" ? "POSTED" : "CANCELLED",
      postedAt: d.action === "POST" ? new Date() : null,
      postedByName: actor.name,
    },
  });
  await audit(tx, actor, d.action + "_STOCK_COUNT", "StockCount", count.id, {
    note: d.note,
  });
  return updated;
}
export const cartScope = (lines: QuoteLineInput[]) =>
  hash(
    lines
      .map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        addonIds: [...l.addonIds].sort(),
        notes: l.notes || "",
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
export async function approvalAction(
  tx: DB,
  actor: SessionUser,
  d: z.infer<typeof schemas.approvals>,
) {
  if (d.action === "REQUEST") {
    const amount = paise(d.amount);
    if (amount <= 0n) throw badRequest("Amount must be positive.");
    let orderNumber: string | undefined;
    let context;
    if (d.kind === "REFUND") {
      if (!d.orderId) throw badRequest("Choose a cancelled order.");
      const order = await tx.order.findUniqueOrThrow({
        where: { id: d.orderId },
      });
      if (
        !order.businessTracked ||
        order.status !== "CANCELLED" ||
        amount > paise(order.amountPaid) - paise(order.amountRefunded)
      )
        throw badRequest(
          "Refund must match an outstanding cancelled-order refund.",
        );
      orderNumber = order.orderNumber;
    } else {
      if (!canBusiness(actor, "pos") || !d.lines?.length || amount % 100n)
        throw badRequest(
          "A counter discount needs the exact cart and a whole-rupee amount.",
        );
    }
    if (d.kind === "DISCOUNT") {
      const settings = await tx.cafeSetting.findUniqueOrThrow({
        where: { id: 1 },
      });
      const quote = await priceCart(
        { lines: d.lines!, orderType: "PICKUP" },
        settings,
        tx,
      );
      if (amount > BigInt(quote.subtotal) * 100n)
        throw badRequest("Requested discount exceeds this cart subtotal.");
      context = {
        subtotal: quote.subtotal,
        items: quote.lines.map((l) => ({
          name: l.productName,
          quantity: l.quantity,
          lineTotal: l.lineTotal,
        })),
      };
    }
    const approval = await tx.cafeApproval.create({
      data: {
        kind: d.kind,
        context,
        amount: d.amount,
        orderId: d.kind === "REFUND" ? d.orderId : null,
        orderNumber,
        scopeHash: d.kind === "DISCOUNT" ? cartScope(d.lines!) : null,
        reason: d.reason,
        requestedById: actor.id,
        requestedByName: actor.name,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    await audit(tx, actor, "REQUEST_" + d.kind, "Approval", approval.id, {
      amount: d.amount,
      reason: d.reason,
    });
    return approval;
  }
  if (!reviewer(actor)) throw forbidden("Manager or owner approval required.");
  const approval = await tx.cafeApproval.findUniqueOrThrow({
    where: { id: d.id },
  });
  if (approval.status !== "PENDING" || approval.expiresAt <= new Date())
    throw badRequest("This request is no longer awaiting review.");
  if (approval.requestedById === actor.id && actor.role !== "ADMIN")
    throw forbidden("Another manager or the owner must review your request.");
  const updated = await tx.cafeApproval.update({
    where: { id: approval.id },
    data: {
      status: d.approved ? "APPROVED" : "REJECTED",
      reviewedById: actor.id,
      reviewedByName: actor.name,
      reviewedAt: new Date(),
      reviewNote: d.note,
    },
  });
  await audit(
    tx,
    actor,
    d.approved ? "APPROVE_" + approval.kind : "REJECT_" + approval.kind,
    "Approval",
    approval.id,
    { note: d.note },
  );
  return updated;
}
export async function consumeRefundApproval(
  tx: DB,
  actor: SessionUser,
  data: { approvalId?: string; orderId: string; amount: string },
) {
  if (actor.role === "ADMIN") return;
  if (!data.approvalId)
    throw forbidden("Request manager approval before recording this refund.");
  const a = await tx.cafeApproval.findUniqueOrThrow({
    where: { id: data.approvalId },
  });
  if (
    a.kind !== "REFUND" ||
    a.status !== "APPROVED" ||
    a.expiresAt <= new Date() ||
    a.requestedById !== actor.id ||
    a.orderId !== data.orderId ||
    paise(a.amount) !== paise(data.amount)
  )
    throw forbidden(
      "This refund approval is expired, used, or does not match this request.",
    );
  await tx.cafeApproval.update({
    where: { id: a.id },
    data: { status: "USED", usedAt: new Date(), resultId: data.orderId },
  });
  await audit(tx, actor, "USE_REFUND_APPROVAL", "Approval", a.id, {
    orderId: data.orderId,
    amount: data.amount,
  });
}
export async function applyCounterDiscount(
  tx: DB,
  actor: SessionUser,
  approvalId: string,
  lines: QuoteLineInput[],
  quote: Quote,
  taxPercent: number,
) {
  const a = await tx.cafeApproval.findUniqueOrThrow({
    where: { id: approvalId },
  });
  if (
    a.kind !== "DISCOUNT" ||
    a.status !== "APPROVED" ||
    a.expiresAt <= new Date() ||
    a.requestedById !== actor.id ||
    a.scopeHash !== cartScope(lines)
  )
    throw forbidden(
      "Discount approval does not match this cashier/cart, or has expired or been used.",
    );
  const amount = Number(a.amount);
  if (quote.discount || quote.loyaltyDiscount || amount > quote.subtotal)
    throw badRequest(
      "Approved discount cannot be combined or exceed the subtotal.",
    );
  quote.discount = amount;
  quote.tax = Math.round(((quote.subtotal - amount) * taxPercent) / 100);
  quote.total = quote.subtotal - amount + quote.tax + quote.deliveryFee;
}

import "server-only";
import { assertDemoMoney } from "./demo-identity";
import type { Order } from "@prisma/client";
import type { SessionUser } from "@/lib/types";
import { settleLoyalty } from "@/server/loyalty";
import { badRequest } from "@/server/api";
import { paise, decimal, distribute, businessToday } from "@/lib/business-math";
import {
  accountBalance,
  audit,
  journal,
  moneyAccount,
  reverseJournal,
  type DB,
} from "./core";
import { consumeOrder } from "./inventory";
const rupees = (amount: number) => BigInt(amount) * 100n;
export async function receiveOrderMoney(
  tx: DB,
  actor: SessionUser,
  input: {
    orderId: string;
    amount: bigint;
    accountId: string;
    requestId: string;
    refund?: boolean;
    note: string;
    date?: string;
  },
) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: input.orderId },
  });
  if (!order.businessTracked)
    throw badRequest(
      "This order belongs to the legacy period. Use an opening balance for historical dues.",
    );
  const amount = input.amount;
  if (amount <= 0n)
    throw badRequest("Payment amount must be greater than zero.");
  const prior = await tx.businessJournal.findUnique({
    where: { eventKey: "payment:" + input.requestId },
  });
  if (prior) return order;
  const paid = paise(order.amountPaid),
    refunded = paise(order.amountRefunded);
  if (input.refund) {
    if (order.status !== "CANCELLED" || amount > paid - refunded)
      throw badRequest(
        "Refund cannot exceed the amount still owed to this cancelled order.",
      );
  } else {
    if (
      order.status === "CANCELLED" ||
      amount > rupees(order.total) - paid + refunded
    )
      throw badRequest("Payment exceeds the remaining bill.");
  }
  const { account, shiftId } = await moneyAccount(tx, actor, input.accountId);
  await assertDemoMoney(tx,"Order",order.id,account);
  if (input.refund && amount > (await accountBalance(tx, account.id)))
    throw badRequest(
      "Not enough recorded funds in the selected refund account.",
    );
  const posted = await journal(tx, actor, {
    key: "payment:" + input.requestId,
    source: input.refund ? "ORDER_REFUND" : "ORDER_RECEIPT",
    sourceId: order.id,
    orderId: order.id,
    shiftId,
    note: input.note,
    date: input.date,
    lines: input.refund
      ? [
          {
            code: "CUSTOMER_CONTROL",
            debit: amount,
            partyId: order.businessPartyId,
          },
          { accountId: account.id, credit: amount },
        ]
      : [
          { accountId: account.id, debit: amount },
          {
            code: "CUSTOMER_CONTROL",
            credit: amount,
            partyId: order.businessPartyId,
          },
        ],
  });
  await tx.businessPayment.create({
    data: {
      kind: input.refund ? "ORDER_REFUND" : "ORDER_RECEIPT",
      orderId: order.id,
      partyId: order.businessPartyId,
      accountId: account.id,
      journalId: posted.id,
      amount: decimal(amount),
      date: posted.date,
      note: input.note,
    },
  });
  const newPaid = paid + (input.refund ? 0n : amount),
    newRefunded = refunded + (input.refund ? amount : 0n);
  const state =
    order.status === "CANCELLED"
      ? newPaid > 0n && newRefunded >= newPaid
        ? "REFUNDED"
        : newPaid > newRefunded
          ? "PAID"
          : "UNPAID"
      : newRefunded > 0n && newRefunded === newPaid
        ? "REFUNDED"
        : newPaid - newRefunded >= rupees(order.total)
          ? "PAID"
          : "UNPAID";
  const updated = await tx.order.update({
    where: { id: order.id },
    data: {
      ...(!input.refund && !order.cashierId ? { cashierId: actor.id, cashierName: actor.name } : {}),
      ...(!input.refund && !order.cashShiftId && shiftId ? { cashShiftId: shiftId } : {}),
      amountPaid: decimal(newPaid),
      amountRefunded: decimal(newRefunded),
      paymentStatus: state,
    },
  });
  if (updated.status === "DELIVERED" && updated.paymentStatus === "PAID")
    await settleLoyalty(tx, updated, false);
  await audit(
    tx,
    actor,
    input.refund ? "REFUND" : "RECEIVE_PAYMENT",
    "Order",
    order.id,
    { amount: decimal(amount), account: account.name, note: input.note },
  );
  return updated;
}
export async function invoiceOrder(tx: DB, actor: SessionUser, id: string) {
  let order = await tx.order.findUniqueOrThrow({
    where: { id },
    include: { items: true },
  });
  if (!order.businessTracked || order.businessInvoicedAt) return;
  await consumeOrder(tx, actor, id);
  order = await tx.order.findUniqueOrThrow({
    where: { id },
    include: { items: true },
  });
  const food = rupees(order.subtotal - order.discount),
    delivery = rupees(order.deliveryFee),
    tax = rupees(order.tax),
    total = rupees(order.total);
  if (total)
    await journal(tx, actor, {
      key: "sale:" + id,
      source: "SALE",
      sourceId: id,
      orderId: id,
      note: `Sale #${order.orderNumber}`,
      lines: [
        {
          code: "CUSTOMER_CONTROL",
          debit: total,
          partyId: order.businessPartyId,
        },
        { code: "FOOD_SALES", credit: food },
        { code: "DELIVERY_SALES", credit: delivery },
        { code: "TAX_PAYABLE", credit: tax },
      ],
    });
  const used = await tx.stockMovement.findMany({
    where: { orderId: id, kind: "PREPARATION" },
  });
  const cost = used.reduce((s, m) => s - paise(m.value), 0n);
  if (cost)
    await journal(tx, actor, {
      key: "cogs:" + id,
      source: "COGS",
      sourceId: id,
      orderId: id,
      note: `Food cost #${order.orderNumber}`,
      lines: [
        { code: "COGS", debit: cost },
        { code: "WIP", credit: cost },
      ],
    });
  const discounts = distribute(
    rupees(order.discount),
    order.items.map((l) => rupees(l.lineTotal)),
  );
  for (let i = 0; i < order.items.length; i++) {
    const line = order.items[i],
      gross = rupees(line.lineTotal),
      itemCost = used
        .filter((m) => m.orderItemKey === line.id)
        .reduce((s, m) => s - paise(m.value), 0n);
    await tx.businessSaleLine.create({
      data: {
        eventKey: "sale:" + line.id,
        orderId: id,
        orderItemKey: line.id,
        productName: line.productName,
        quantity: line.quantity,
        gross: decimal(gross),
        discount: decimal(discounts[i]),
        net: decimal(gross - discounts[i]),
        cost: decimal(itemCost),
        date: new Date(businessToday() + "T00:00:00Z"),
      },
    });
  }
  await tx.order.update({
    where: { id },
    data: { businessInvoicedAt: new Date() },
  });
  await audit(tx, actor, "INVOICE", "Order", id, {
    total: decimal(total),
    cost: decimal(cost),
  });
}
export async function voidBusinessOrder(
  tx: DB,
  actor: SessionUser,
  order: Order,
  note: string,
) {
  if (!order.businessTracked || order.businessVoidedAt) return;
  await tx.ingredientReservation.updateMany({
    where: { orderId: order.id, consumedAt: null, releasedAt: null },
    data: { releasedAt: new Date() },
  });
  const latest = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
  if (latest.businessInvoicedAt) {
    for (const key of ["sale:", "cogs:"]) {
      const entry = await tx.businessJournal.findUnique({
        where: { eventKey: key + order.id },
      });
      if (entry)
        await reverseJournal(
          tx,
          actor,
          entry.id,
          "void:" + key + order.id,
          note,
        );
    }
    const lines = await tx.businessSaleLine.findMany({
      where: { orderId: order.id, quantity: { gt: 0 } },
    });
    for (const l of lines)
      await tx.businessSaleLine.create({
        data: {
          eventKey: "refund:" + l.id,
          orderId: order.id,
          orderItemKey: l.orderItemKey,
          productName: l.productName,
          quantity: -l.quantity,
          gross: decimal(-paise(l.gross)),
          discount: decimal(-paise(l.discount)),
          net: decimal(-paise(l.net)),
          cost: decimal(-paise(l.cost)),
          date: new Date(businessToday() + "T00:00:00Z"),
        },
      });
  }
  if (latest.businessConsumedAt) {
    const entries = await tx.stockMovement.findMany({
      where: { orderId: order.id, kind: "PREPARATION" },
    });
    const cost = entries.reduce((s, m) => s - paise(m.value), 0n);
    if (cost)
      await journal(tx, actor, {
        key: "cancel-waste:" + order.id,
        source: "WASTE",
        sourceId: order.id,
        orderId: order.id,
        note: "Prepared food cancelled: " + note,
        lines: [
          { code: "WASTE", debit: cost },
          { code: "WIP", credit: cost },
        ],
      });
  }
  await tx.order.update({
    where: { id: order.id },
    data: { businessVoidedAt: new Date() },
  });
  await audit(tx, actor, "CANCEL_ORDER", "Order", order.id, {
    reason: note,
    refundDue: decimal(paise(latest.amountPaid) - paise(latest.amountRefunded)),
    ingredientsReturned: false,
  });
}
export async function validateCredit(tx: DB, partyId: string, total: bigint) {
  const party = await tx.businessParty.findUniqueOrThrow({
    where: { id: partyId },
  });
  if (
    party.kind !== "CUSTOMER" ||
    !party.isActive ||
    paise(party.creditLimit) <= 0n
  )
    throw badRequest(
      "Choose an active customer with an approved credit limit.",
    );
  const due = await accountBalance(tx, "CUSTOMER_CONTROL", party.id);
  const orders = await tx.order.findMany({
    where: { businessPartyId: party.id, businessTracked: true },
  });
  // Receipts already reduce the control balance. Add pending gross invoices
  // once, and exclude refund liabilities from the available credit limit.
  const unbilled = orders
    .filter((o) => !o.businessInvoicedAt && o.status !== "CANCELLED")
    .reduce((s, o) => s + rupees(o.total), 0n);
  const refundsOwed = orders
    .filter((o) => o.status === "CANCELLED")
    .reduce((s, o) => s + paise(o.amountPaid) - paise(o.amountRefunded), 0n);
  if (due + unbilled + refundsOwed + total > paise(party.creditLimit))
    throw badRequest("This sale would exceed the customer credit limit.");
}

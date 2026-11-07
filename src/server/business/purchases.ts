import "server-only";
import type { SessionUser } from "@/lib/types";
import { badRequest } from "@/server/api";
import { paise, quantity, decimal, divideRound } from "@/lib/business-math";
import { accountBalance, audit, journal, moneyAccount, type DB } from "./core";
import { receiveOrderMoney } from "./order-ledger";
import { moveStock } from "./inventory";
export async function postPurchase(
  tx: DB,
  actor: SessionUser,
  data: {
    requestId: string;
    supplierId: string;
    invoiceNumber: string;
    date: string;
    note?: string;
    lines: { ingredientId: string; quantity: string; totalCost: string }[];
    paid: string;
    accountId?: string;
  },
) {
  const supplier = await tx.businessParty.findUniqueOrThrow({
    where: { id: data.supplierId },
  });
  if (supplier.kind !== "SUPPLIER" || !supplier.isActive)
    throw badRequest("Choose an active supplier.");
  if (new Set(data.lines.map((l) => l.ingredientId)).size !== data.lines.length)
    throw badRequest(
      "Combine duplicate ingredients into a single purchase line.",
    );
  const total = data.lines.reduce((s, l) => s + paise(l.totalCost), 0n),
    paid = paise(data.paid);
  if (total <= 0n || paid > total)
    throw badRequest("Purchase total and payment do not match.");
  const purchase = await tx.businessPurchase.create({
    data: {
      supplierId: supplier.id,
      invoiceNumber: data.invoiceNumber,
      date: new Date(data.date + "T00:00:00Z"),
      total: decimal(total),
      note: data.note,
      lines: {
        create: data.lines.map((l) => ({
          ingredientId: l.ingredientId,
          quantity: l.quantity,
          totalCost: l.totalCost,
        })),
      },
    },
    include: { lines: true },
  });
  for (const line of purchase.lines)
    await moveStock(tx, actor, {
      key: "purchase:" + line.id,
      ingredientId: line.ingredientId,
      kind: "PURCHASE",
      delta: quantity(line.quantity),
      incomingValue: paise(line.totalCost),
      note: `Supplier invoice ${data.invoiceNumber}`,
      purchaseLineId: line.id,
    });
  await journal(tx, actor, {
    key: "purchase:" + data.requestId,
    source: "PURCHASE",
    sourceId: purchase.id,
    date: data.date,
    note: `${supplier.name}: ${data.invoiceNumber}`,
    lines: [
      { code: "INVENTORY", debit: total },
      { code: "SUPPLIER_CONTROL", credit: total, partyId: supplier.id },
    ],
  });
  if (paid) {
    if (!data.accountId) throw badRequest("Choose the payment account.");
    await payParty(tx, actor, {
      requestId: data.requestId + ":payment",
      kind: "SUPPLIER_PAYMENT",
      partyId: supplier.id,
      purchaseId: purchase.id,
      amount: decimal(paid),
      accountId: data.accountId,
      date: data.date,
      note: `Paid invoice ${data.invoiceNumber}`,
    });
  }
  await audit(tx, actor, "PURCHASE", "Purchase", purchase.id, {
    invoice: data.invoiceNumber,
    total: decimal(total),
    supplier: supplier.name,
  });
  return purchase;
}
export async function returnPurchase(
  tx: DB,
  actor: SessionUser,
  data: {
    requestId: string;
    lineId: string;
    quantity: string;
    note: string;
    date: string;
  },
) {
  const line = await tx.purchaseLine.findUniqueOrThrow({
    where: { id: data.lineId },
    include: { purchase: true },
  });
  const qty = quantity(data.quantity),
    remaining = quantity(line.quantity) - quantity(line.returnedQuantity);
  if (qty <= 0n || qty > remaining)
    throw badRequest("Return exceeds the unreturned invoice quantity.");
  const refundCost =
    qty === remaining
      ? paise(line.totalCost) - paise(line.returnedCost)
      : divideRound(paise(line.totalCost) * qty, quantity(line.quantity));
  const { cost } = await moveStock(tx, actor, {
    key: "purchase-return:" + data.requestId,
    ingredientId: line.ingredientId,
    kind: "PURCHASE_RETURN",
    delta: -qty,
    note: data.note,
    purchaseLineId: line.id,
  });
  const difference = refundCost - cost;
  await journal(tx, actor, {
    key: "purchase-return:" + data.requestId,
    source: "PURCHASE_RETURN",
    sourceId: line.purchaseId,
    date: data.date,
    note: data.note,
    lines: [
      {
        code: "SUPPLIER_CONTROL",
        debit: refundCost,
        partyId: line.purchase.supplierId,
      },
      { code: "INVENTORY", credit: cost },
      ...(difference > 0n
        ? [{ code: "PURCHASE_VARIANCE", credit: difference }]
        : difference < 0n
          ? [{ code: "PURCHASE_VARIANCE", debit: -difference }]
          : []),
    ],
  });
  await tx.purchaseLine.update({
    where: { id: line.id },
    data: {
      returnedQuantity: decimal(quantity(line.returnedQuantity) + qty, 4),
      returnedCost: decimal(paise(line.returnedCost) + refundCost),
    },
  });
  await audit(tx, actor, "PURCHASE_RETURN", "Purchase", line.purchaseId, {
    quantity: data.quantity,
    value: decimal(refundCost),
    note: data.note,
  });
  return { returned: data.quantity, value: decimal(refundCost) };
}
export async function payParty(
  tx: DB,
  actor: SessionUser,
  data: {
    requestId: string;
    kind: string;
    partyId: string;
    amount: string;
    accountId: string;
    date: string;
    note: string;
    purchaseId?: string;
    payrollId?: string;
  },
) {
  if (data.payrollId && data.kind !== "PAYROLL_PAYMENT")
    throw badRequest("Only a payroll payment may reference a payroll record.");
  if (data.purchaseId && data.kind !== "SUPPLIER_PAYMENT")
    throw badRequest(
      "Only an invoice payment may reference a supplier purchase.",
    );
  const party = await tx.businessParty.findUniqueOrThrow({
    where: { id: data.partyId },
  });
  const amount = paise(data.amount);
  if (amount <= 0n) throw badRequest("Payment must be positive.");
  const { account, shiftId } = await moneyAccount(tx, actor, data.accountId);
  let debit: string, credit: string;
  if (data.kind === "SUPPLIER_PAYMENT") {
    if (party.kind !== "SUPPLIER") throw badRequest("Choose a supplier.");
    debit = "SUPPLIER_CONTROL";
    credit = account.code;
    if (data.purchaseId) {
      const purchase = await tx.businessPurchase.findUniqueOrThrow({
        where: { id: data.purchaseId },
      });
      if (purchase.supplierId !== party.id)
        throw badRequest("Invoice belongs to a different supplier.");
    }
  } else if (data.kind === "SUPPLIER_REFUND") {
    if (
      party.kind !== "SUPPLIER" ||
      amount > (await accountBalance(tx, "SUPPLIER_CONTROL", party.id))
    )
      throw badRequest("Refund exceeds the supplier credit balance.");
    debit = account.code;
    credit = "SUPPLIER_CONTROL";
  } else if (data.kind === "STAFF_REPAYMENT") {
    if (
      party.kind !== "EMPLOYEE" ||
      amount > (await accountBalance(tx, "STAFF_ADVANCES", party.id))
    )
      throw badRequest("Recovery exceeds the outstanding staff advance.");
    debit = account.code;
    credit = "STAFF_ADVANCES";
  } else if (data.kind === "STAFF_ADVANCE") {
    if (party.kind !== "EMPLOYEE") throw badRequest("Choose a staff member.");
    debit = "STAFF_ADVANCES";
    credit = account.code;
  } else if (data.kind === "SALARY_BALANCE_PAYMENT") {
    if (party.kind !== "EMPLOYEE") throw badRequest("Choose an employee.");
    const payrolls = await tx.payrollRecord.findMany({
      where: { employee: { partyId: party.id }, status: "POSTED" },
      include: {
        payments: { include: { journal: { include: { reversedBy: true } } } },
      },
    });
    const reserved = payrolls.reduce(
      (s, p) =>
        s +
        paise(p.netPay) -
        p.payments
          .filter((v) => !v.journal.reversedBy)
          .reduce((n, v) => n + paise(v.amount), 0n),
      0n,
    );
    const legacyDue =
      -(await accountBalance(tx, "SALARIES_PAYABLE", party.id)) - reserved;
    if (amount > legacyDue)
      throw badRequest(
        "This exceeds legacy salary dues. Pay new payroll using its own payroll record.",
      );
    debit = "SALARIES_PAYABLE";
    credit = account.code;
  } else if (data.kind === "PAYROLL_PAYMENT") {
    if (!data.payrollId) throw badRequest("Choose a posted payroll.");
    const pay = await tx.payrollRecord.findUniqueOrThrow({
      where: { id: data.payrollId },
      include: {
        employee: true,
        payments: { include: { journal: { include: { reversedBy: true } } } },
      },
    });
    if (pay.status !== "POSTED" || pay.employee.partyId !== party.id)
      throw badRequest("Payroll is not payable.");
    const paid = pay.payments
      .filter((p) => !p.journal.reversedBy)
      .reduce((s, p) => s + paise(p.amount), 0n);
    if (amount > paise(pay.netPay) - paid)
      throw badRequest("Payment exceeds the payroll balance.");
    debit = "SALARIES_PAYABLE";
    credit = account.code;
  } else if (data.kind === "CUSTOMER_RECEIPT") {
    if (party.kind !== "CUSTOMER") throw badRequest("Choose a customer.");
    if (amount > (await accountBalance(tx, "CUSTOMER_CONTROL", party.id)))
      throw badRequest("Payment exceeds the customer balance.");
    debit = account.code;
    credit = "CUSTOMER_CONTROL";
  } else throw badRequest("Unsupported payment type.");
  if (data.kind === "CUSTOMER_RECEIPT") {
    let remaining = amount;
    const orders = await tx.order.findMany({
      where: {
        businessPartyId: party.id,
        businessTracked: true,
        status: "DELIVERED",
      },
      orderBy: { createdAt: "asc" },
    });
    const allocations = [];
    for (const order of orders) {
      const due =
        BigInt(order.total) * 100n -
        paise(order.amountPaid) +
        paise(order.amountRefunded);
      const applied = remaining > due ? due : remaining;
      if (applied > 0n) {
        await receiveOrderMoney(tx, actor, {
          orderId: order.id,
          amount: applied,
          accountId: account.id,
          requestId: data.requestId + ":" + order.id,
          note: data.note,
          date: data.date,
        });
        allocations.push({ orderId: order.id, amount: decimal(applied) });
        remaining -= applied;
      }
      if (!remaining) break;
    }
    if (!remaining) return { allocations, amount: data.amount };
    data = { ...data, amount: decimal(remaining) };
  }
  const actualAmount = paise(data.amount);
  if (
    !["CUSTOMER_RECEIPT", "SUPPLIER_REFUND", "STAFF_REPAYMENT"].includes(
      data.kind,
    ) &&
    actualAmount > (await accountBalance(tx, account.id))
  )
    throw badRequest(
      "This payment account does not have enough recorded funds.",
    );
  const posted = await journal(tx, actor, {
    key: "party-payment:" + data.requestId,
    source: data.kind,
    sourceId: data.payrollId ?? data.purchaseId ?? party.id,
    note: data.note,
    date: data.date,
    shiftId,
    lines: [
      {
        code: debit,
        debit: actualAmount,
        partyId: debit === account.code ? null : party.id,
      },
      {
        code: credit,
        credit: actualAmount,
        partyId: credit === account.code ? null : party.id,
      },
    ],
  });
  const payment = await tx.businessPayment.create({
    data: {
      kind: data.kind,
      partyId: party.id,
      purchaseId: data.purchaseId,
      payrollId: data.payrollId,
      accountId: account.id,
      journalId: posted.id,
      amount: decimal(actualAmount),
      date: posted.date,
      note: data.note,
    },
  });
  await audit(tx, actor, data.kind, "Payment", payment.id, {
    amount: decimal(actualAmount),
    party: party.name,
    note: data.note,
  });
  return payment;
}

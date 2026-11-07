import "server-only";
import type { SessionUser } from "@/lib/types";
import { badRequest, forbidden } from "@/server/api";
import { paise, decimal } from "@/lib/business-math";
import {
  accountBalance,
  audit,
  journal,
  moneyAccount,
  reverseJournal,
  type DB,
} from "./core";
import { reviewer } from "./operations";
export const EXPENSE_CODES = [
  "RENT",
  "GAS",
  "ELECTRICITY",
  "PACKAGING",
  "DELIVERY_EXPENSE",
  "REPAIRS",
  "OTHER_EXPENSE",
] as const;
export async function cashAction(
  tx: DB,
  actor: SessionUser,
  data: {
    requestId: string;
    action: string;
    drawerId?: string;
    shiftId?: string;
    amount: string;
    note: string;
    denominations?: { value: string; count: number }[];
  },
) {
  if (data.action === "OPEN") {
    const drawer = await tx.cashDrawer.findUniqueOrThrow({
      where: { id: data.drawerId },
    });
    if (!drawer.isActive) throw badRequest("This cash drawer is inactive.");
    if (
      await tx.cashShift.findFirst({
        where: {
          OR: [{ drawerId: drawer.id }, { openedById: actor.id }],
          closedAt: null,
        },
      })
    )
      throw badRequest("This drawer or cashier already has an open shift.");
    const expected = await accountBalance(tx, drawer.accountId);
    if (paise(data.amount) !== expected)
      throw badRequest(
        `Opening count must match the recorded balance of Rs. ${decimal(expected)}. Ask the owner to record an opening balance or cash correction first.`,
      );
    const shift = await tx.cashShift.create({
      data: {
        drawerId: drawer.id,
        openedById: actor.id,
        openedByName: actor.name,
        openingCash: data.amount,
      },
    });
    await audit(tx, actor, "OPEN_SHIFT", "Shift", shift.id, {
      count: data.amount,
      drawer: drawer.name,
    });
    return shift;
  }
  const shift = await tx.cashShift.findUniqueOrThrow({
    where: { id: data.shiftId },
    include: { drawer: true },
  });
  if (data.action === "REVIEW") {
    if (!reviewer(actor)) throw forbidden("Manager or owner review required.");
    if (!shift.closedAt || shift.reviewedAt)
      throw badRequest("Choose a closed shift awaiting review.");
    if (shift.closedById === actor.id && actor.role !== "ADMIN")
      throw forbidden("Another manager or the owner must review your closing.");
    if (data.note.trim().length < 3) throw badRequest("Add a review note.");
    const reviewed = await tx.cashShift.update({
      where: { id: shift.id },
      data: {
        reviewedAt: new Date(),
        reviewedById: actor.id,
        reviewedByName: actor.name,
        reviewNote: data.note,
      },
    });
    await audit(tx, actor, "REVIEW_SHIFT", "Shift", shift.id, {
      note: data.note,
      variance: String(shift.variance),
    });
    return reviewed;
  }
  if (shift.closedAt) throw badRequest("This shift is already closed.");
  if (shift.openedById !== actor.id && actor.role !== "ADMIN")
    throw forbidden("Only this cashier or the owner can close the shift.");
  const expected = await accountBalance(tx, shift.drawer.accountId),
    actual = paise(data.amount),
    variance = actual - expected;
  if (data.denominations) {
    if (
      new Set(data.denominations.map((d) => d.value)).size !==
        data.denominations.length ||
      data.denominations.reduce(
        (s, d) => s + paise(d.value) * BigInt(d.count),
        0n,
      ) !== actual
    )
      throw badRequest(
        "Denomination count does not match the physical closing amount.",
      );
  }
  if (variance && !data.note.trim())
    throw badRequest("Explain the cash difference before closing.");
  if (variance)
    await journal(tx, actor, {
      key: "shift-close:" + shift.id,
      source: "CASH_CLOSE",
      sourceId: shift.id,
      note: data.note,
      shiftId: shift.id,
      lines:
        variance > 0n
          ? [
              { accountId: shift.drawer.accountId, debit: variance },
              { code: "CASH_DIFFERENCE", credit: variance },
            ]
          : [
              { code: "CASH_DIFFERENCE", debit: -variance },
              { accountId: shift.drawer.accountId, credit: -variance },
            ],
    });
  const closed = await tx.cashShift.update({
    where: { id: shift.id },
    data: {
      closedAt: new Date(),
      expectedCash: decimal(expected),
      actualCash: decimal(actual),
      variance: decimal(variance),
      closeNote: data.note,
      closedById: actor.id,
      closedByName: actor.name,
      denominations: data.denominations,
    },
  });
  await audit(tx, actor, "CLOSE_SHIFT", "Shift", shift.id, {
    expected: decimal(expected),
    actual: decimal(actual),
    variance: decimal(variance),
    note: data.note,
  });
  return closed;
}
export async function moneyAction(
  tx: DB,
  actor: SessionUser,
  data: {
    requestId: string;
    kind: string;
    amount: string;
    accountId: string;
    toAccountId?: string;
    expenseCode?: string;
    partyId?: string;
    date: string;
    note: string;
  },
) {
  const amount = paise(data.amount);
  if (amount <= 0n) throw badRequest("Amount must be positive.");
  const opening = data.kind === "OPENING";
  if (
    opening &&
    (await tx.businessConfig.findUniqueOrThrow({ where: { id: 1 } })).enabled
  )
    throw badRequest(
      "Opening balances are closed after activation. Use owner investment or a correction.",
    );
  if (
    [
      "OPENING",
      "CAPITAL",
      "DRAW",
      "TRANSFER",
      "CORRECTION",
      "CORRECTION_IN",
    ].includes(data.kind) &&
    actor.role !== "ADMIN"
  )
    throw forbidden("Owner access is required for this money movement.");
  const { account, shiftId } = await moneyAccount(
    tx,
    actor,
    data.accountId,
    opening || ["CAPITAL", "CORRECTION", "CORRECTION_IN"].includes(data.kind),
  );
  let lines;
  if (data.kind === "EXPENSE") {
    if (
      !EXPENSE_CODES.includes(
        data.expenseCode as (typeof EXPENSE_CODES)[number],
      )
    )
      throw badRequest("Choose an expense category.");
    lines = [
      { code: data.expenseCode, debit: amount },
      { accountId: account.id, credit: amount },
    ];
  } else if (data.kind === "OPENING" || data.kind === "CAPITAL")
    lines = [
      { accountId: account.id, debit: amount },
      { code: opening ? "OPENING_EQUITY" : "CAPITAL", credit: amount },
    ];
  else if (data.kind === "DRAW")
    lines = [
      { code: "OWNER_DRAW", debit: amount },
      { accountId: account.id, credit: amount },
    ];
  else if (data.kind === "TRANSFER") {
    if (!data.toAccountId) throw badRequest("Choose the destination.");
    const to = await moneyAccount(tx, actor, data.toAccountId);
    if (to.account.id === account.id)
      throw badRequest("Choose different accounts.");
    lines = [
      { accountId: to.account.id, debit: amount },
      { accountId: account.id, credit: amount },
    ];
  } else if (data.kind === "CORRECTION_IN")
    lines = [
      { accountId: account.id, debit: amount },
      { code: "CASH_DIFFERENCE", credit: amount },
    ];
  else if (data.kind === "CORRECTION")
    lines = [
      { code: "CASH_DIFFERENCE", debit: amount },
      { accountId: account.id, credit: amount },
    ];
  else throw badRequest("Unsupported cash movement.");
  if (
    ["EXPENSE", "DRAW", "TRANSFER", "CORRECTION"].includes(data.kind) &&
    amount > (await accountBalance(tx, account.id))
  )
    throw badRequest("This money account does not have enough recorded funds.");
  const entry = await journal(tx, actor, {
    key: "money:" + data.requestId,
    source: data.kind,
    sourceId: data.requestId,
    note: data.note,
    date: data.date,
    shiftId,
    lines,
  });
  await audit(tx, actor, data.kind, "Journal", entry.id, {
    amount: data.amount,
    account: account.name,
    note: data.note,
  });
  return entry;
}
export async function openingParty(
  tx: DB,
  actor: SessionUser,
  data: {
    requestId: string;
    partyId: string;
    kind: string;
    amount: string;
    date: string;
    note: string;
  },
) {
  if (actor.role !== "ADMIN") throw forbidden();
  const party = await tx.businessParty.findUniqueOrThrow({
    where: { id: data.partyId },
  });
  const amount = paise(data.amount);
  if (amount <= 0n) throw badRequest("Amount must be positive.");
  const credit = data.kind === "SUPPLIER_DUE" || data.kind === "SALARY_DUE";
  const code =
    data.kind === "SUPPLIER_DUE"
      ? "SUPPLIER_CONTROL"
      : data.kind === "SALARY_DUE"
        ? "SALARIES_PAYABLE"
        : data.kind === "STAFF_ADVANCE"
          ? "STAFF_ADVANCES"
          : "CUSTOMER_CONTROL";
  if (
    (code === "SUPPLIER_CONTROL" && party.kind !== "SUPPLIER") ||
    (["SALARIES_PAYABLE", "STAFF_ADVANCES"].includes(code) &&
      party.kind !== "EMPLOYEE") ||
    (code === "CUSTOMER_CONTROL" && party.kind !== "CUSTOMER")
  )
    throw badRequest("Opening balance type does not match the selected party.");
  const result = await journal(tx, actor, {
    key: "opening-party:" + data.requestId,
    source: "OPENING",
    sourceId: party.id,
    note: data.note,
    date: data.date,
    lines: credit
      ? [
          { code: "OPENING_EQUITY", debit: amount },
          { code, credit: amount, partyId: party.id },
        ]
      : [
          { code, debit: amount, partyId: party.id },
          { code: "OPENING_EQUITY", credit: amount },
        ],
  });
  await audit(tx, actor, "OPENING_PARTY", "Party", party.id, {
    kind: data.kind,
    amount: data.amount,
  });
  return result;
}
export async function reverseMoney(
  tx: DB,
  actor: SessionUser,
  data: { id: string; note: string; requestId: string },
) {
  const entry = await tx.businessJournal.findUniqueOrThrow({
    where: { id: data.id },
    include: { postings: { include: { account: true } }, payments: true },
  });
  if (
    ![
      "EXPENSE",
      "CAPITAL",
      "DRAW",
      "TRANSFER",
      "CORRECTION",
      "CORRECTION_IN",
      "OPENING",
      "SUPPLIER_PAYMENT",
      "SUPPLIER_REFUND",
      "STAFF_ADVANCE",
      "STAFF_REPAYMENT",
      "PAYROLL_PAYMENT",
      "SALARY_BALANCE_PAYMENT",
      "CUSTOMER_RECEIPT",
    ].includes(entry.source)
  )
    throw badRequest(
      "Use the order, stock, purchase return or payroll action to correct this entry.",
    );
  let currentShift: string | undefined;
  // A reversed advance may not consume money already recovered through payroll.
  for (const line of entry.postings) {
    if (
      line.account.code === "STAFF_ADVANCES" &&
      paise(line.debit) > 0n &&
      (await accountBalance(tx, line.accountId, line.partyId ?? undefined)) <
        paise(line.debit)
    )
      throw badRequest(
        "This advance has already been recovered. Reverse the unpaid payroll first.",
      );
    if (line.account.isMoney) {
      const verified = await moneyAccount(tx, actor, line.accountId);
      currentShift = verified.shiftId ?? currentShift;
      if (
        paise(line.debit) > 0n &&
        (await accountBalance(tx, line.accountId)) < paise(line.debit)
      )
        throw badRequest(
          "Not enough funds to reverse the original cash receipt.",
        );
    }
  }
  const result = await reverseJournal(
    tx,
    actor,
    entry.id,
    "manual-reversal:" + data.requestId,
    data.note,
    currentShift,
  );
  await audit(tx, actor, "REVERSE_ENTRY", "Journal", entry.id, {
    reason: data.note,
    reversal: result.id,
  });
  return result;
}

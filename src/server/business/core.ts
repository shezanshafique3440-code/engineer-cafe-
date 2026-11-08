import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/types";
import { badRequest, forbidden, HttpError, requireAdmin } from "@/server/api";
import { canBusiness } from "@/lib/business-access";
import { businessToday, dateValue, paise, decimal } from "@/lib/business-math";
export type DB = Prisma.TransactionClient;
export async function businessLock(tx: DB) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(73190422)`;
  await tx.$queryRaw`SELECT set_config('cafe.business_session','1',true)`;
}
export async function businessActor(cap: string) {
  const actor = await requireAdmin(cap);
  if (!canBusiness(actor, cap))
    throw forbidden(
      "Your staff role cannot access this part of the cafe system.",
    );
  return actor;
}
export const ACCOUNTS = [
  ["CASH_MAIN", "Main cash drawer", "ASSET", true],
  ["BANK", "Bank", "ASSET", true],
  ["WALLET", "Digital wallet", "ASSET", true],
  ["RIDER_CASH", "Cash held by riders", "ASSET", true],
  ["CUSTOMER_CONTROL", "Customer balances", "ASSET", false],
  ["INVENTORY", "Ingredient inventory", "ASSET", false],
  ["WIP", "Food in preparation", "ASSET", false],
  ["STAFF_ADVANCES", "Staff advances", "ASSET", false],
  ["SUPPLIER_CONTROL", "Supplier balances", "LIABILITY", false],
  ["SALARIES_PAYABLE", "Salaries payable", "LIABILITY", false],
  ["TAX_PAYABLE", "Tax collected", "LIABILITY", false],
  ["OPENING_EQUITY", "Opening balances", "EQUITY", false],
  ["CAPITAL", "Owner investment", "EQUITY", false],
  ["OWNER_DRAW", "Owner withdrawals", "EQUITY", false],
  ["FOOD_SALES", "Food sales", "INCOME", false],
  ["DELIVERY_SALES", "Delivery income", "INCOME", false],
  ["COGS", "Cost of food sold", "EXPENSE", false],
  ["SALARIES", "Salaries expense", "EXPENSE", false],
  ["RENT", "Rent", "EXPENSE", false],
  ["GAS", "Gas", "EXPENSE", false],
  ["ELECTRICITY", "Electricity", "EXPENSE", false],
  ["PACKAGING", "Packaging", "EXPENSE", false],
  ["RIDERS_PAYABLE", "Rider commissions payable", "LIABILITY", false],
  ["DELIVERY_EXPENSE", "Delivery expenses", "EXPENSE", false],
  ["REPAIRS", "Repairs and maintenance", "EXPENSE", false],
  ["OTHER_EXPENSE", "Other expenses", "EXPENSE", false],
  ["WASTE", "Wastage and staff meals", "EXPENSE", false],
  ["CASH_DIFFERENCE", "Cash over / short", "EXPENSE", false],
  ["PURCHASE_VARIANCE", "Purchase return variance", "EXPENSE", false],
  ["STOCK_VARIANCE", "Stock count differences", "EXPENSE", false],
] as const;
export async function ensureBusiness(tx: DB) {
  const initialized = await tx.businessConfig.findUnique({ where: { id: 1 } });
  if (
    initialized &&
    (await tx.businessAccount.count({
      where: { code: { in: ACCOUNTS.map((a) => a[0]) } },
    })) === ACCOUNTS.length
  )
    return;
  await tx.businessConfig.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
  for (const [code, name, kind, isMoney] of ACCOUNTS)
    await tx.businessAccount.upsert({
      where: { code },
      create: { code, name, kind, isMoney },
      update: {},
    });
  const cash = await tx.businessAccount.findUniqueOrThrow({
    where: { code: "CASH_MAIN" },
  });
  await tx.cashDrawer.upsert({
    where: { accountId: cash.id },
    create: { name: "Main counter", accountId: cash.id },
    update: {},
  });
}
export async function businessTx<T>(fn: (tx: DB) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await businessLock(tx);
      await ensureBusiness(tx);
      return fn(tx);
    },
    { timeout: 20000 },
  );
}
export async function audit(
  tx: DB,
  actor: SessionUser,
  action: string,
  entity: string,
  entityId: string,
  details: Prisma.InputJsonValue,
) {
  await tx.businessAudit.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      action,
      entity,
      entityId,
      details,
    },
  });
}
export function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export async function journal(
  tx: DB,
  actor: SessionUser,
  input: {
    key: string;
    source: string;
    sourceId: string;
    note: string;
    date?: string;
    orderId?: string;
    shiftId?: string;
    reversalOfId?: string;
    lines: {
      code?: string;
      accountId?: string;
      debit?: bigint;
      credit?: bigint;
      partyId?: string | null;
    }[];
  },
) {
  const previous = await tx.businessJournal.findUnique({
    where: { eventKey: input.key },
    include: { postings: true },
  });
  if (previous) return previous;
  const config = await tx.businessConfig.findUniqueOrThrow({
    where: { id: 1 },
  });
  const date = dateValue(input.date ?? businessToday());
  if (date > dateValue(businessToday()))
    throw badRequest("Future financial entries cannot be posted.");
  if (config.lockedThrough && date <= config.lockedThrough)
    throw badRequest("This accounting date is closed. Choose an open period.");
  const lines = input.lines.filter(
    (l) => (l.debit ?? 0n) !== 0n || (l.credit ?? 0n) !== 0n,
  );
  const debit = lines.reduce((s, l) => s + (l.debit ?? 0n), 0n),
    credit = lines.reduce((s, l) => s + (l.credit ?? 0n), 0n);
  if (debit !== credit || debit <= 0n || lines.length < 2)
    throw badRequest(
      "A posted journal must have equal positive debits and credits.",
    );
  const rows = [];
  for (const line of lines) {
    if (
      (line.debit ?? 0n) < 0n ||
      (line.credit ?? 0n) < 0n ||
      ((line.debit ?? 0n) > 0n && (line.credit ?? 0n) > 0n)
    )
      throw badRequest("Invalid journal line.");
    const account = await tx.businessAccount.findFirst({
      where: line.accountId
        ? { id: line.accountId, isActive: true }
        : { code: line.code, isActive: true },
    });
    if (!account) throw badRequest("Account unavailable.");
    rows.push({
      accountId: account.id,
      debit: decimal(line.debit ?? 0n),
      credit: decimal(line.credit ?? 0n),
      partyId: line.partyId ?? null,
    });
  }
  return tx.businessJournal.create({
    data: {
      eventKey: input.key,
      source: input.source,
      sourceId: input.sourceId,
      note: input.note,
      date,
      actorId: actor.id,
      actorName: actor.name,
      orderId: input.orderId,
      shiftId: input.shiftId,
      reversalOfId: input.reversalOfId,
      postings: { create: rows },
    },
    include: { postings: true },
  });
}
export async function reverseJournal(
  tx: DB,
  actor: SessionUser,
  id: string,
  key: string,
  note: string,
  shiftId?: string,
) {
  const original = await tx.businessJournal.findUniqueOrThrow({
    where: { id },
    include: { postings: true, reversedBy: true },
  });
  if (original.reversalOfId || original.reversedBy)
    throw badRequest("This entry has already been reversed.");
  return journal(tx, actor, {
    key,
    source: "REVERSAL",
    sourceId: original.id,
    note,
    reversalOfId: original.id,
    orderId: original.orderId ?? undefined,
    shiftId,
    lines: original.postings.map((p) => ({
      accountId: p.accountId,
      debit: paise(p.credit),
      credit: paise(p.debit),
      partyId: p.partyId,
    })),
  });
}
export async function accountBalance(
  tx: DB,
  codeOrId: string,
  partyId?: string,
) {
  const result = await tx.businessPosting.aggregate({
    where: {
      account: { OR: [{ id: codeOrId }, { code: codeOrId }] },
      ...(partyId ? { partyId } : {}),
    },
    _sum: { debit: true, credit: true },
  });
  return paise(result._sum.debit ?? 0) - paise(result._sum.credit ?? 0);
}
export async function moneyAccount(
  tx: DB,
  actor: SessionUser,
  id: string,
  allowOpening = false,
) {
  const account = await tx.businessAccount.findFirst({
    where: { OR: [{ id }, { code: id }], isMoney: true, isActive: true },
    include: { drawer: true },
  });
  if (!account)
    throw badRequest("Choose an available cash, bank or wallet account.");
  let shiftId: string | undefined;
  if (account.drawer) {
    const shift = await tx.cashShift.findFirst({
      where: { drawerId: account.drawer.id, closedAt: null },
    });
    if (!shift) {
      if (!(allowOpening && actor.role === "ADMIN"))
        throw badRequest(
          "Open a cash shift for this drawer before recording cash.",
        );
    } else {
      if (shift.openedById !== actor.id && !canBusiness(actor, "expenses"))
        throw forbidden("This cash drawer belongs to another cashier.");
      shiftId = shift.id;
    }
  }
  return { account, shiftId };
}
export async function versionCheck(version: string | undefined, actual: Date) {
  if (!version || version !== actual.toISOString())
    throw new HttpError(
      409,
      "This record changed. Refresh and review before saving.",
    );
}

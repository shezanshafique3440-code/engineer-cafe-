import "server-only";
import { assertDemoMoney } from "./demo-identity";
import type { SessionUser } from "@/lib/types";
import { canBusiness } from "@/lib/business-access";
import { badRequest, forbidden } from "@/server/api";
import {
  businessToday,
  decimal,
  divideRound,
  paise,
} from "@/lib/business-math";
import {
  accountBalance,
  accountBalances,
  audit,
  journal,
  moneyAccount,
  reverseJournal,
  type DB,
  versionCheck,
} from "./core";
import type { schemas } from "./validation";
import type { z } from "zod";

type Action = z.infer<typeof schemas.delivery>;
export async function riderCash(tx: DB, riderId: string) {
  const receipts = await tx.businessPayment.findMany({
    where: {
      order: { riderId },
      account: { code: "RIDER_CASH" },
      kind: { in: ["ORDER_RECEIPT", "ORDER_REFUND"] },
    },
    select: { kind: true, amount: true },
  });
  const transfers = await tx.deliveryTransfer.findMany({
    where: { riderId },
    include: { account: { select: { code: true } } },
  });
  return (
    receipts.reduce(
      (sum, p) =>
        sum + (p.kind === "ORDER_REFUND" ? -paise(p.amount) : paise(p.amount)),
      0n,
    ) -
    transfers
      .filter(
        (t) =>
          t.kind === "REMITTANCE" ||
          (t.kind === "COMMISSION" && t.account.code === "RIDER_CASH"),
      )
      .reduce((sum, p) => sum + paise(p.amount), 0n)
  );
}

/** Called inside the same locked transaction as delivery/invoicing. */
export async function accrueDelivery(
  tx: DB,
  actor: SessionUser,
  orderId: string,
) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.orderType !== "DELIVERY" || !order.businessTracked) return;
  if (!order.riderId)
    throw badRequest("Assign a rider before completing delivery.");
  if (await tx.deliveryCommission.findUnique({ where: { orderId } })) return;
  const rider = await tx.deliveryRider.findUniqueOrThrow({
    where: { id: order.riderId },
  });
  const basis = BigInt(order.subtotal - order.discount) * 100n;
  const amount = divideRound(basis * 15n, 100n);
  const posted = amount
    ? await journal(tx, actor, {
        key: "rider-commission:" + orderId,
        source: "RIDER_COMMISSION",
        sourceId: orderId,
        orderId,
        note: `15% delivery commission #${order.orderNumber}`,
        lines: [
          { code: "DELIVERY_EXPENSE", debit: amount, partyId: rider.partyId },
          { code: "RIDERS_PAYABLE", credit: amount, partyId: rider.partyId },
        ],
      })
    : null;
  await tx.deliveryCommission.create({
    data: {
      orderId,
      riderId: rider.id,
      rate: 15,
      basis: decimal(basis),
      amount: decimal(amount),
      journalId: posted?.id,
      date: new Date(businessToday() + "T00:00:00Z"),
    },
  });
  await audit(tx, actor, "ACCRUE_RIDER_COMMISSION", "Order", orderId, {
    rider: rider.code,
    basis: decimal(basis),
    rate: 15,
    amount: decimal(amount),
  });
}

/** Reversal retains any actual payouts; a negative payable is a rider recovery balance. */
export async function reverseDelivery(
  tx: DB,
  actor: SessionUser,
  orderId: string,
  note: string,
) {
  const earned = await tx.deliveryCommission.findUnique({ where: { orderId } });
  if (!earned || earned.reversedAt) return;
  const reversal = earned.journalId
    ? await reverseJournal(
        tx,
        actor,
        earned.journalId,
        "rider-commission-void:" + orderId,
        note,
      )
    : null;
  await tx.deliveryCommission.update({
    where: { id: earned.id },
    data: { reversedAt: new Date(), reversalJournalId: reversal?.id },
  });
  await audit(tx, actor, "REVERSE_RIDER_COMMISSION", "Order", orderId, {
    riderId: earned.riderId,
    amount: decimal(paise(earned.amount)),
    reason: note,
  });
}

export async function deliveryAction(tx: DB, actor: SessionUser, data: Action) {
  if (data.action === "SAVE") {
    const old = data.id
      ? await tx.deliveryRider.findUniqueOrThrow({ where: { id: data.id } })
      : null;
    if (old) await versionCheck(data.version, old.updatedAt);
    if (
      old &&
      !data.isActive &&
      (await tx.order.count({
        where: {
          riderId: old.id,
          status: { notIn: ["DELIVERED", "CANCELLED"] },
        },
      }))
    )
      throw badRequest(
        "Finish or reassign this rider's active deliveries first.",
      );
    const party = old
      ? await tx.businessParty.update({
          where: { id: old.partyId },
          data: { name: data.name, phone: data.phone, isActive: data.isActive },
        })
      : await tx.businessParty.create({
          data: {
            kind: "RIDER",
            name: data.name,
            phone: data.phone,
            isActive: data.isActive,
          },
        });
    const rider = old
      ? await tx.deliveryRider.update({
          where: { id: old.id },
          data: { code: data.code, isActive: data.isActive },
        })
      : await tx.deliveryRider.create({
          data: { code: data.code, partyId: party.id, isActive: data.isActive },
        });
    await audit(
      tx,
      actor,
      old ? "UPDATE_RIDER" : "CREATE_RIDER",
      "Rider",
      rider.id,
      { code: rider.code, name: data.name, isActive: data.isActive },
    );
    return rider;
  }
  const rider = await tx.deliveryRider.findUniqueOrThrow({
    where: { id: data.riderId },
  });
  if (data.action === "ASSIGN") {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: data.orderId },
    });
    await versionCheck(data.version, order.updatedAt);
    if (
      !rider.isActive ||
      order.orderType !== "DELIVERY" ||
      !order.businessTracked ||
      ["DELIVERED", "CANCELLED", "OUT_FOR_DELIVERY"].includes(order.status)
    )
      throw badRequest(
        "Choose an active rider and an undelivered, tracked delivery order before dispatch.",
      );
    const result = await tx.order.update({
      where: { id: order.id },
      data: {
        riderId: rider.id,
        riderAssignedAt: new Date(),
        events: {
          create: {
            status: order.status,
            note: `Assigned to ${rider.code} · ${rider.partyId}: ${data.note}`,
          },
        },
      },
    });
    await audit(tx, actor, "ASSIGN_RIDER", "Order", order.id, {
      beforeRiderId: order.riderId,
      riderId: rider.id,
      reason: data.note,
    });
    return result;
  }
  const amount = paise(data.amount);
  if (amount <= 0n) throw badRequest("Enter an amount greater than zero.");
  const { account, shiftId } = await moneyAccount(tx, actor, data.accountId);
  await assertDemoMoney(tx, "DeliveryRider", rider.id, account);
  const cashHeld = await riderCash(tx, rider.id);
  if (data.action === "RECOVER") {
    if (!canBusiness(actor, "finance"))
      throw forbidden(
        "Owner financial access is required to recover commission overpayments.",
      );
    if (account.code === "RIDER_CASH")
      throw badRequest(
        "Choose the cash, bank or wallet receiving the recovery.",
      );
    const due = -(await accountBalance(tx, "RIDERS_PAYABLE", rider.partyId));
    if (due >= 0n || amount > -due)
      throw badRequest(
        "Recovery exceeds this rider's recorded commission overpayment.",
      );
    const posted = await journal(tx, actor, {
      key: "rider-transfer:" + data.requestId,
      source: "RIDER_COMMISSION_RECOVERY",
      sourceId: rider.id,
      shiftId,
      note: data.note,
      lines: [
        { accountId: account.id, debit: amount },
        { code: "RIDERS_PAYABLE", credit: amount, partyId: rider.partyId },
      ],
    });
    const recovered = await tx.deliveryTransfer.create({
      data: {
        riderId: rider.id,
        kind: "RECOVERY",
        amount: decimal(amount),
        accountId: account.id,
        journalId: posted.id,
        date: posted.date,
        note: data.note,
      },
    });
    await audit(tx, actor, "RECOVER_RIDER_COMMISSION", "Rider", rider.id, {
      amount: decimal(amount),
      reason: data.note,
    });
    return recovered;
  }
  if (data.action === "SETTLE") {
    if (!canBusiness(actor, "finance"))
      throw forbidden(
        "Owner financial access is required for commission payouts.",
      );
    const due = -(await accountBalance(tx, "RIDERS_PAYABLE", rider.partyId));
    if (amount > due)
      throw badRequest("Payment exceeds this rider's outstanding commission.");
    if (amount > (await accountBalance(tx, account.id)))
      throw badRequest("Insufficient recorded money in the payment account.");
    if (account.code === "RIDER_CASH" && amount > cashHeld)
      throw badRequest(
        "This rider is not holding enough cash for this payout.",
      );
  } else {
    if (!canBusiness(actor, "payments"))
      throw forbidden("Payment access is required for rider cash collection.");
    if (account.code === "RIDER_CASH")
      throw badRequest(
        "Choose the drawer, bank or wallet receiving rider cash.",
      );
    if (amount > cashHeld)
      throw badRequest("Collection exceeds the cash recorded with this rider.");
    if (amount > (await accountBalance(tx, "RIDER_CASH")))
      throw badRequest(
        "The rider cash control account needs reconciliation before this collection.",
      );
  }
  const settlement = data.action === "SETTLE";
  const posted = await journal(tx, actor, {
    key: "rider-transfer:" + data.requestId,
    source: settlement ? "RIDER_COMMISSION_PAYMENT" : "RIDER_CASH_REMITTANCE",
    sourceId: rider.id,
    shiftId,
    note: data.note,
    lines: settlement
      ? [
          { code: "RIDERS_PAYABLE", debit: amount, partyId: rider.partyId },
          { accountId: account.id, credit: amount },
        ]
      : [
          { accountId: account.id, debit: amount },
          { code: "RIDER_CASH", credit: amount },
        ],
  });
  const result = await tx.deliveryTransfer.create({
    data: {
      riderId: rider.id,
      kind: settlement ? "COMMISSION" : "REMITTANCE",
      amount: decimal(amount),
      accountId: account.id,
      journalId: posted.id,
      date: posted.date,
      note: data.note,
    },
  });
  await audit(
    tx,
    actor,
    settlement ? "PAY_RIDER_COMMISSION" : "COLLECT_RIDER_CASH",
    "Rider",
    rider.id,
    { amount: decimal(amount), account: account.name, reason: data.note },
  );
  return result;
}

export async function deliveryRead(tx: DB, start: Date, end: Date) {
  const filter = { gte: start, lte: end };
  const startTime = new Date(start.getTime() - 5 * 3600000),
    endTime = new Date(end.getTime() + 86400000 - 5 * 3600000);
  const [riders, orders] = await Promise.all([
    tx.deliveryRider.findMany({
      include: {
        party: true,
        commissions: { where: { date: filter } },
        transfers: {
          where: { date: filter },
          include: { account: { select: { name: true, code: true } } },
        },
        orders: {
          where: {
            deliveredAt: { gte: startTime, lt: endTime },
            status: "DELIVERED",
          },
          select: { placedAt: true, deliveredAt: true },
        },
      },
      orderBy: { code: "asc" },
    }),
    tx.order.findMany({
      where: {
        orderType: "DELIVERY",
        businessTracked: true,
        OR: [
          { status: { notIn: ["DELIVERED", "CANCELLED"] } },
          { deliveredAt: { gte: startTime, lt: endTime } },
        ],
      },
      include: {
        rider: { include: { party: { select: { name: true } } } },
        deliveryCommission: true,
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);
  const [balances, reversals, activeOrders, cashReceipts, cashTransfers] =
    await Promise.all([
      accountBalances(
        tx,
        ["RIDERS_PAYABLE"],
        riders.map((r) => r.partyId),
      ),
      tx.businessPosting.groupBy({
        by: ["partyId"],
        where: {
          partyId: { in: riders.map((r) => r.partyId) },
          account: { code: "RIDERS_PAYABLE" },
          journal: {
            source: "REVERSAL",
            date: filter,
            reversalOf: { source: "RIDER_COMMISSION" },
          },
        },
        _sum: { debit: true },
      }),
      tx.order.groupBy({
        by: ["riderId"],
        where: {
          riderId: { in: riders.map((r) => r.id) },
          status: { notIn: ["CANCELLED", "DELIVERED"] },
        },
        _count: { _all: true },
      }),
      tx.$queryRaw<
        { riderId: string; amount: string }[]
      >`SELECT o."riderId", SUM(CASE WHEN p.kind='ORDER_REFUND' THEN -p.amount ELSE p.amount END)::text AS amount FROM "BusinessPayment" p JOIN "Order" o ON o.id=p."orderId" JOIN "BusinessAccount" a ON a.id=p."accountId" WHERE o."riderId" IS NOT NULL AND a.code='RIDER_CASH' AND p.kind IN ('ORDER_RECEIPT','ORDER_REFUND') GROUP BY o."riderId"`,
      tx.$queryRaw<
        { riderId: string; amount: string }[]
      >`SELECT t."riderId", SUM(t.amount)::text AS amount FROM "DeliveryTransfer" t JOIN "BusinessAccount" a ON a.id=t."accountId" WHERE t.kind='REMITTANCE' OR (t.kind='COMMISSION' AND a.code='RIDER_CASH') GROUP BY t."riderId"`,
    ]);
  const summaries = [];
  for (const r of riders) {
    const earned = r.commissions.reduce((s, c) => s + paise(c.amount), 0n);
    // Reversals belong to their reversal journal's date, even if the original sale is outside this range.
    const reversed = paise(
      reversals.find((p) => p.partyId === r.partyId)?._sum.debit ?? 0,
    );
    const paid = r.transfers
      .filter((t) => t.kind === "COMMISSION")
      .reduce((s, t) => s + paise(t.amount), 0n);
    const recovered = r.transfers
      .filter((t) => t.kind === "RECOVERY")
      .reduce((s, t) => s + paise(t.amount), 0n);
    const due = -balances("RIDERS_PAYABLE", r.partyId);
    const active =
      activeOrders.find((o) => o.riderId === r.id)?._count._all ?? 0;
    summaries.push({
      ...r,
      commissions: undefined,
      orders: undefined,
      version: r.updatedAt.toISOString(),
      earned: decimal(earned),
      reversed: decimal(reversed),
      paid: decimal(paid),
      recovered: decimal(recovered),
      due: decimal(due),
      cashHeld: decimal(
        paise(cashReceipts.find((p) => p.riderId === r.id)?.amount ?? 0) -
          paise(cashTransfers.find((p) => p.riderId === r.id)?.amount ?? 0),
      ),
      active,
      delivered: r.orders.length,
      averageMinutes: r.orders.length
        ? Math.round(
            r.orders.reduce(
              (s, o) =>
                s +
                ((o.deliveredAt?.getTime() || o.placedAt.getTime()) -
                  o.placedAt.getTime()) /
                  60000,
              0,
            ) / r.orders.length,
          )
        : null,
    });
  }
  return {
    riders: summaries,
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      addressLine: o.addressLine,
      status: o.status,
      total: o.total,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      businessCredit: o.businessCredit,
      remainingDue: decimal(
        BigInt(o.total) * 100n - paise(o.amountPaid) + paise(o.amountRefunded),
      ),
      riderId: o.riderId,
      riderName: o.rider?.party.name,
      commission: o.deliveryCommission,
      version: o.updatedAt.toISOString(),
    })),
    totals: {
      earned: decimal(summaries.reduce((s, r) => s + paise(r.earned), 0n)),
      reversed: decimal(summaries.reduce((s, r) => s + paise(r.reversed), 0n)),
      paid: decimal(summaries.reduce((s, r) => s + paise(r.paid), 0n)),
      recovered: decimal(
        summaries.reduce((s, r) => s + paise(r.recovered), 0n),
      ),
      due: decimal(summaries.reduce((s, r) => s + paise(r.due), 0n)),
      cashHeld: decimal(summaries.reduce((s, r) => s + paise(r.cashHeld), 0n)),
      cashControl: decimal(await accountBalance(tx, "RIDER_CASH")),
      unattributedCash: decimal(
        (await accountBalance(tx, "RIDER_CASH")) -
          summaries.reduce((s, r) => s + paise(r.cashHeld), 0n),
      ),
    },
  };
}

import "server-only";
import type { SessionUser } from "@/lib/types";
import { badRequest, HttpError } from "@/server/api";
import {
  paise,
  quantity,
  decimal,
  payrollMath,
  businessToday,
  dateValue,
} from "@/lib/business-math";
import {
  accountBalance,
  audit,
  hash,
  journal,
  reverseJournal,
  type DB,
} from "./core";
export async function payrollSource(
  tx: DB,
  employeeId: string,
  start: string,
  end: string,
  bonus: string,
  deduction: string,
  recoverAdvance: boolean,
) {
  const first = dateValue(start),
    last = dateValue(end);
  if (start.slice(0, 7) !== end.slice(0, 7) || first > last)
    throw badRequest("A pay period must be within one calendar month.");
  const employee = await tx.employee.findUniqueOrThrow({
    where: { id: employeeId },
    include: { party: true },
  });
  const overlap = await tx.payrollRecord.findFirst({
    where: {
      employeeId,
      status: "POSTED",
      startsOn: { lte: last },
      endsOn: { gte: first },
    },
  });
  if (overlap)
    throw badRequest(
      "This employee already has a posted payroll overlapping these dates.",
    );
  const attendance = await tx.attendance.findMany({
    where: { employeeId, date: { gte: first, lte: last } },
    orderBy: { date: "asc" },
  });
  const begin = employee.joinedOn > first ? employee.joinedOn : first,
    finish = employee.leftOn && employee.leftOn < last ? employee.leftOn : last;
  const activeDays = Math.max(
    0,
    Math.round((finish.getTime() - begin.getTime()) / 86400000) + 1,
  );
  if (!activeDays)
    throw badRequest("Employment dates do not overlap this pay period.");
  const rows = attendance.filter((a) => a.date >= begin && a.date <= finish);
  const days = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  let unpaidHalfDays = 0,
    presentHalfDays = 0,
    overtime = 0n;
  for (const a of rows) {
    if (["ABSENT", "UNPAID_LEAVE"].includes(a.status)) unpaidHalfDays += 2;
    else if (a.status === "HALF_DAY") {
      unpaidHalfDays++;
      presentHalfDays++;
    } else presentHalfDays += 2;
    overtime += quantity(a.overtimeHours);
  }
  const advance = recoverAdvance
    ? await accountBalance(tx, "STAFF_ADVANCES", employee.partyId)
    : 0n;
  let result: ReturnType<typeof payrollMath>;
  try {
    result = payrollMath({
      basis: employee.payBasis,
      base: paise(employee.basePay),
      days,
      activeDays,
      unpaidHalfDays,
      presentHalfDays,
      overtimeUnits: overtime,
      overtimeRate: paise(employee.overtimeRate),
      bonus: paise(bonus),
      deduction: paise(deduction),
      advance: advance > 0n ? advance : 0n,
    });
  } catch (e) {
    throw badRequest(
      e instanceof Error ? e.message : "Invalid payroll amounts.",
    );
  }
  const snapshot = {
    name: employee.party.name,
    code: employee.code,
    payBasis: employee.payBasis,
    contractPay: employee.basePay.toString(),
    overtimeRate: employee.overtimeRate.toString(),
    activeDays,
    daysInMonth: days,
    attendanceDays: rows.length,
    missingAttendanceDays: Math.max(0, activeDays - rows.length),
    unpaidHalfDays,
    overtimeHours: decimal(overtime, 4),
    start,
    end,
    advanceAvailable: decimal(advance > 0n ? advance : 0n),
    bonus,
    deduction,
    recoverAdvance,
  };
  const sourceHash = hash({
    employeeVersion: employee.updatedAt.toISOString(),
    partyVersion: employee.party.updatedAt.toISOString(),
    rows: rows.map((a) => [a.id, a.updatedAt.toISOString()]),
    snapshot,
  });
  return { employee, result, snapshot, sourceHash };
}
export async function draftPayroll(
  tx: DB,
  actor: SessionUser,
  data: {
    employeeId: string;
    start: string;
    end: string;
    bonus: string;
    deduction: string;
    recoverAdvance: boolean;
    note: string;
    id?: string;
    version?: string;
  },
) {
  const source = await payrollSource(
    tx,
    data.employeeId,
    data.start,
    data.end,
    data.bonus,
    data.deduction,
    data.recoverAdvance,
  );
  const payload = {
    employeeId: data.employeeId,
    period: `${data.start} — ${data.end}`,
    startsOn: dateValue(data.start),
    endsOn: dateValue(data.end),
    basePay: decimal(source.result.base),
    unpaidDeduction: decimal(source.result.unpaid),
    overtimePay: decimal(source.result.overtime),
    bonus: data.bonus,
    manualDeduction: data.deduction,
    advanceApplied: decimal(source.result.recovery),
    earnedPay: decimal(source.result.earned),
    netPay: decimal(source.result.net),
    sourceHash: source.sourceHash,
    snapshot: source.snapshot,
    note: data.note,
  };
  let record;
  if (data.id) {
    const old = await tx.payrollRecord.findUniqueOrThrow({
      where: { id: data.id },
    });
    if (old.status !== "DRAFT" || old.updatedAt.toISOString() !== data.version)
      throw new HttpError(
        409,
        "Payroll draft changed. Refresh before editing.",
      );
    record = await tx.payrollRecord.update({
      where: { id: old.id },
      data: payload,
    });
  } else record = await tx.payrollRecord.create({ data: payload });
  await audit(tx, actor, "DRAFT_PAYROLL", "Payroll", record.id, {
    employee: source.employee.party.name,
    netPay: payload.netPay,
  });
  return record;
}
export async function postPayroll(
  tx: DB,
  actor: SessionUser,
  data: { id: string; version: string; acknowledgeAttendance: boolean },
) {
  const record = await tx.payrollRecord.findUniqueOrThrow({
    where: { id: data.id },
  });
  if (
    record.status !== "DRAFT" ||
    record.updatedAt.toISOString() !== data.version
  )
    throw new HttpError(409, "Refresh this payroll draft before posting.");
  if (record.endsOn > dateValue(businessToday()))
    throw badRequest(
      "This pay period has not finished. Record an advance for an early payment.",
    );
  const snapshot = record.snapshot as { recoverAdvance: boolean };
  const source = await payrollSource(
    tx,
    record.employeeId,
    record.startsOn.toISOString().slice(0, 10),
    record.endsOn.toISOString().slice(0, 10),
    record.bonus.toString(),
    record.manualDeduction.toString(),
    snapshot.recoverAdvance,
  );
  if (source.sourceHash !== record.sourceHash)
    throw new HttpError(
      409,
      "Salary, attendance or advance balance changed. Recalculate the draft first.",
    );
  if (source.snapshot.missingAttendanceDays && !data.acknowledgeAttendance)
    throw badRequest(
      "Review and acknowledge missing attendance before posting payroll.",
    );
  const earned = paise(record.earnedPay),
    advance = paise(record.advanceApplied),
    net = paise(record.netPay);
  if (earned)
    await journal(tx, actor, {
      key: "payroll:" + record.id,
      source: "PAYROLL",
      date: record.endsOn.toISOString().slice(0, 10),
      sourceId: record.id,
      note: `${source.employee.party.name}: ${record.period}`,
      lines: [
        { code: "SALARIES", debit: earned },
        {
          code: "SALARIES_PAYABLE",
          credit: earned,
          partyId: source.employee.partyId,
        },
      ],
    });
  if (advance)
    await journal(tx, actor, {
      key: "payroll-recovery:" + record.id,
      source: "PAYROLL_RECOVERY",
      sourceId: record.id,
      note: `Advance recovered from payroll: ${source.employee.party.name}`,
      lines: [
        {
          code: "SALARIES_PAYABLE",
          debit: advance,
          partyId: source.employee.partyId,
        },
        {
          code: "STAFF_ADVANCES",
          credit: advance,
          partyId: source.employee.partyId,
        },
      ],
    });
  await tx.payrollRecord.update({
    where: { id: record.id },
    data: { status: "POSTED" },
  });
  await audit(tx, actor, "POST_PAYROLL", "Payroll", record.id, {
    earned: decimal(earned),
    advanceRecovered: decimal(advance),
    payable: decimal(net),
  });
  return { id: record.id, status: "POSTED" };
}
export async function reversePayroll(
  tx: DB,
  actor: SessionUser,
  data: { id: string; note: string },
) {
  const record = await tx.payrollRecord.findUniqueOrThrow({
    where: { id: data.id },
    include: {
      payments: { include: { journal: { include: { reversedBy: true } } } },
    },
  });
  if (
    record.status !== "POSTED" ||
    record.payments.some((p) => !p.journal.reversedBy)
  )
    throw badRequest(
      "Only unpaid posted payroll can be reversed. Reverse its payments first.",
    );
  for (const prefix of ["payroll:", "payroll-recovery:"]) {
    const entry = await tx.businessJournal.findUnique({
      where: { eventKey: prefix + record.id },
    });
    if (entry)
      await reverseJournal(
        tx,
        actor,
        entry.id,
        "reverse:" + prefix + record.id,
        data.note,
      );
  }
  await tx.payrollRecord.update({
    where: { id: record.id },
    data: { status: "REVERSED" },
  });
  await audit(tx, actor, "REVERSE_PAYROLL", "Payroll", record.id, {
    reason: data.note,
  });
  return { id: record.id, status: "REVERSED" };
}

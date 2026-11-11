import "server-only";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, badRequest } from "@/server/api";
import { dateValue, decimal, paise } from "@/lib/business-math";
import { REPORT_SHEETS, type SheetSpec } from "./complete-report-sheets";

type Row = Record<string, unknown>;
type Bounds = {
  from: string;
  to: string;
  dates: { gte: Date; lt: Date };
  timestamps: { gte: Date; lt: Date };
};
const DAY = 86400000;
const SHEET_LIMIT = 50000;
const TOTAL_LIMIT = 150000;

export function reportBounds(url: URL): Bounds {
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  let start: Date, end: Date;
  try {
    start = dateValue(from);
    end = dateValue(to);
  } catch {
    throw badRequest("Choose real From and To dates.");
  }
  if (start > end || end.getTime() - start.getTime() > 732 * DAY)
    throw badRequest(
      "Choose a date range of up to two years, with From before To.",
    );
  const next = new Date(end.getTime() + DAY);
  return {
    from,
    to,
    dates: { gte: start, lt: next },
    timestamps: {
      gte: new Date(start.getTime() - 5 * 3600000),
      lt: new Date(next.getTime() - 5 * 3600000),
    },
  };
}
const dateFields = new Set([
  "date",
  "joinedOn",
  "leftOn",
  "startsOn",
  "endsOn",
  "expectedOn",
]);
function nested(path: string, value: unknown): Row {
  return path
    .split(".")
    .reverse()
    .reduce<unknown>((v, key) => ({ [key]: v }), value) as Row;
}
function selection(fields: string[]) {
  const select: Row = {};
  for (const path of fields) {
    const parts = path.split(".");
    let node = select;
    parts.forEach((key, index) => {
      if (index === parts.length - 1) node[key] = true;
      else {
        node[key] ??= { select: {} };
        node = (node[key] as { select: Row }).select;
      }
    });
  }
  return select;
}
function scope(spec: SheetSpec, b: Bounds): Row {
  if (spec.scope === null) return {};
  if (spec.scope === "customers")
    return { role: "CUSTOMER", createdAt: { lt: b.timestamps.lt } };
  if (spec.scope === "logins") return { role: { in: ["ADMIN", "STAFF"] } };
  if (spec.scope === "overlap")
    return { startsOn: { lt: b.dates.lt }, endsOn: { gte: b.dates.gte } };
  if (spec.scope === "shiftOverlap" || spec.scope === "tableOverlap")
    return {
      openedAt: { lt: b.timestamps.lt },
      OR: [{ closedAt: null }, { closedAt: { gte: b.timestamps.gte } }],
    };
  if (spec.scope === "delivery")
    return { orderType: "DELIVERY", createdAt: b.timestamps };
  if (spec.scope === "expense")
    return { journal: { date: b.dates }, account: { kind: "EXPENSE" } };
  const leaf = spec.scope.split(".").at(-1)!;
  return nested(spec.scope, dateFields.has(leaf) ? b.dates : b.timestamps);
}
function at(row: Row, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (v, key) => (v && typeof v === "object" ? (v as Row)[key] : null),
      row,
    );
}
function heading(path: string) {
  return path
    .split(".")
    .map((p) =>
      p
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, (c) => c.toUpperCase()),
    )
    .join(" / ");
}
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
function value(v: unknown, path: string): ExcelJS.CellValue {
  if (v == null) return null;
  if (v instanceof Date)
    return dateFields.has(path.split(".").at(-1)!)
      ? v.toISOString().slice(0, 10)
      : formatter.format(v) + " PKT";
  if (Prisma.Decimal.isDecimal(v)) {
    const n = v.toNumber();
    return v.precision() <= 15 && Number.isSafeInteger(Math.round(n * 10000))
      ? n
      : v.toFixed();
  }
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "string")
    return v;
  return JSON.stringify(v);
}
function addSheet(
  book: ExcelJS.Workbook,
  name: string,
  fields: string[],
  records: Row[],
) {
  const sheet = book.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = fields.map((field) => ({
    header: heading(field),
    key: field,
    width: /note|details|lines|address|instructions/i.test(field)
      ? 45
      : /id$/i.test(field)
        ? 29
        : 23,
  }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF304B3B" },
  };
  for (const record of records) {
    const cells = fields.map((field) => value(at(record, field), field));
    // Strings are written as text, never formulas or hyperlinks (including = + - @).
    const row = sheet.addRow(
      cells.map((cell, i) => {
        if (typeof cell === "string" && cell.length > 32000) {
          const ref = `${name} row ${sheet.rowCount + 1} / ${heading(fields[i])}`;
          let continuation = book.getWorksheet("Long text");
          if (!continuation) {
            continuation = book.addWorksheet("Long text");
            continuation.addRow(["Reference", "Part", "Text"]);
          }
          for (let n = 0; n < cell.length; n += 30000)
            continuation.addRow([ref, n / 30000 + 1, cell.slice(n, n + 30000)]);
          return `See Long text: ${ref}`;
        }
        return cell;
      }),
    );
    row.eachCell((cell) => {
      if (typeof cell.value === "number")
        cell.numFmt = "#,##0.####;[Red]-#,##0.####";
    });
  }
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: fields.length },
  };
  return sheet;
}

export async function completeReport(bounds: Bounds, actorName: string) {
  const generated = new Date();
  // One consistent, read-only snapshot. This route does not initialize or change accounting.
  const data = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const config = await tx.businessConfig.findUnique({ where: { id: 1 } });
      const sheets: { spec: SheetSpec; records: Row[] }[] = [];
      let total = 0;
      for (const spec of REPORT_SHEETS) {
        const delegate = (
          tx as unknown as Record<
            string,
            { findMany(args: unknown): Promise<Row[]> }
          >
        )[spec.model];
        const records = await delegate.findMany({
          where: scope(spec, bounds),
          select: selection(spec.fields),
          orderBy: { id: "asc" },
          take: SHEET_LIMIT + 1,
        });
        total += records.length;
        if (records.length > SHEET_LIMIT || total > TOTAL_LIMIT)
          throw new HttpError(
            422,
            "This report is too large. Choose a shorter date range; no partial file was downloaded.",
          );
        sheets.push({ spec, records });
      }
      const accounts = await tx.businessAccount.findMany({
        orderBy: { code: "asc" },
      });
      const period = await tx.businessPosting.groupBy({
        by: ["accountId"],
        where: { journal: { date: bounds.dates } },
        _sum: { debit: true, credit: true },
      });
      const closing = await tx.businessPosting.groupBy({
        by: ["accountId"],
        where: { journal: { date: { lt: bounds.dates.lt } } },
        _sum: { debit: true, credit: true },
      });
      const partyTotals = await tx.businessPosting.groupBy({
        by: ["partyId", "accountId"],
        where: {
          partyId: { not: null },
          journal: { date: { lt: bounds.dates.lt } },
        },
        _sum: { debit: true, credit: true },
      });
      const parties = await tx.businessParty.findMany({
        select: { id: true, kind: true, name: true, phone: true },
      });
      const accountRows = accounts.map((a) => {
        const p = period.find((p) => p.accountId === a.id),
          c = closing.find((p) => p.accountId === a.id);
        const debit = paise(p?._sum.debit ?? 0),
          credit = paise(p?._sum.credit ?? 0),
          balance = paise(c?._sum.debit ?? 0) - paise(c?._sum.credit ?? 0);
        return {
          id: a.id,
          code: a.code,
          name: a.name,
          kind: a.kind,
          moneyAccount: a.isMoney,
          opening: new Prisma.Decimal(decimal(balance - debit + credit)),
          periodDebit: new Prisma.Decimal(decimal(debit)),
          periodCredit: new Prisma.Decimal(decimal(credit)),
          closingDebitMinusCredit: new Prisma.Decimal(decimal(balance)),
        };
      });
      const partyRows = partyTotals.map((p) => {
        const party = parties.find((a) => a.id === p.partyId),
          account = accounts.find((a) => a.id === p.accountId);
        return {
          partyId: p.partyId,
          kind: party?.kind,
          name: party?.name,
          phone: party?.phone,
          accountCode: account?.code,
          account: account?.name,
          debit: p._sum.debit ?? 0,
          credit: p._sum.credit ?? 0,
          balanceDebitMinusCredit: new Prisma.Decimal(
            decimal(paise(p._sum.debit ?? 0) - paise(p._sum.credit ?? 0)),
          ),
        };
      });
      let income = 0n,
        expenses = 0n,
        money = 0n;
      for (const a of accountRows) {
        if (a.kind === "INCOME")
          income += paise(a.periodCredit) - paise(a.periodDebit);
        if (a.kind === "EXPENSE")
          expenses += paise(a.periodDebit) - paise(a.periodCredit);
        if (a.moneyAccount) money += paise(a.closingDebitMinusCredit);
      }
      const orders = sheets.find((s) => s.spec.name === "Orders")!.records;
      return {
        sheets,
        config,
        accounts: accountRows,
        parties: partyRows,
        metrics: [
          {
            metric: "Orders created in date range (all statuses)",
            value: orders.length,
          },
          {
            metric: "Order value (all statuses; not accounting revenue)",
            value: orders.reduce((sum, o) => sum + Number(o.total), 0),
          },
          {
            metric: "Posted accounting income (PKR)",
            value: new Prisma.Decimal(decimal(income)),
          },
          {
            metric: "Posted accounting expenses incl. cost of goods (PKR)",
            value: new Prisma.Decimal(decimal(expenses)),
          },
          {
            metric: "Posted net profit (PKR)",
            value: new Prisma.Decimal(decimal(income - expenses)),
          },
          {
            metric: "All money-account balances at To date (PKR)",
            value: new Prisma.Decimal(decimal(money)),
          },
        ],
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 60000,
      maxWait: 5000,
    },
  );
  const book = new ExcelJS.Workbook();
  book.creator = "Engineer Cafe";
  book.created = generated;
  addSheet(
    book,
    "Summary",
    ["metric", "value"],
    [
      { metric: "From", value: bounds.from },
      { metric: "To (inclusive)", value: bounds.to },
      {
        metric: "Generated (Pakistan time)",
        value: formatter.format(generated) + " PKT",
      },
      { metric: "Downloaded by", value: actorName },
      {
        metric: "Accounting integration enabled",
        value: data.config?.enabled ?? false,
      },
      ...data.metrics,
    ],
  );
  const notes: Row[] = [
    {
      sheet: "All sheets",
      scope:
        "Amounts are PKR. Timestamp ranges use Asia/Karachi, including the entire To day. Accounting dates use the recorded business date. Rows use the consistent database snapshot at download time.",
    },
    {
      sheet: "Summary",
      scope:
        "Income, expense and profit use posted ledger entries, including reversals in the selected period. Draft, untracked, unpaid and cancelled order values are not automatically accounting income. Zero accounting totals can mean accounting has not been activated.",
    },
    {
      sheet: "Orders and related items",
      scope:
        "Orders created in range; status/payment fields reflect the download snapshot. Payments, deliveries completed and accounting entries outside that order creation range may appear in their own dated sheets.",
    },
    {
      sheet: "Current lists",
      scope:
        "Current ingredients/products/recipes/people/settings are download-time snapshots, not historical stock or salary balances. Account and party balances are as of the To date.",
    },
    {
      sheet: "Cash shifts / Table sessions / Payroll",
      scope:
        "Includes records whose shift/session/earning period overlaps the selected dates. Full record values are shown; amounts are not prorated.",
    },
    {
      sheet: "Offline bills",
      scope:
        "Unsynchronized bills saved on counter devices cannot appear until they reach the server. Sync each device before downloading the final report.",
    },
    {
      sheet: "Balances",
      scope:
        "Positive balance means debit; negative means credit. Customer receivables usually debit, supplier/payroll/rider amounts payable usually credit. Keep control accounts separate; do not add unlike balances together.",
    },
    {
      sheet: "Expenses / Journals / Ledger",
      scope:
        "These are different views of the same entries; do not sum sheets together. Expenses contains all EXPENSE-account debit/credit entries including reversals. Order delivery totals also appear in Orders.",
    },
  ];
  addSheet(
    book,
    "Account balances",
    [
      "code",
      "name",
      "kind",
      "moneyAccount",
      "opening",
      "periodDebit",
      "periodCredit",
      "closingDebitMinusCredit",
    ],
    data.accounts,
  );
  addSheet(
    book,
    "Party balances",
    [
      "partyId",
      "kind",
      "name",
      "phone",
      "accountCode",
      "account",
      "debit",
      "credit",
      "balanceDebitMinusCredit",
    ],
    data.parties,
  );
  for (const { spec, records } of data.sheets) {
    addSheet(book, spec.name, spec.fields, records);
    notes.push({
      sheet: spec.name,
      scope:
        spec.scope === null || spec.scope === "logins"
          ? "Current snapshot at download time"
          : spec.scope === "customers"
            ? "Customer directory created before end date; current contact details"
            : `Selected range; date basis: ${spec.scope}`,
      rows: records.length,
    });
  }
  addSheet(book, "Read me", ["sheet", "scope", "rows"], notes);
  return book.xlsx.writeBuffer();
}

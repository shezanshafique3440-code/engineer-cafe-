/** Operational practice setup, using explicitly assumed figures, never genuine sales. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  chmodSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  businessLock,
  ensureBusiness,
  audit,
  accountBalance,
} from "@/server/business/core";
import { stockReadiness } from "@/server/business/inventory";
import { businessAction } from "@/server/business/actions";
import { moneyAction, cashAction } from "@/server/business/cash";
import {
  businessToday,
  decimal,
  paise,
  divideRound,
} from "@/lib/business-math";
import type { SessionUser } from "@/lib/types";
import { seedBusinessDemo, assumedRecipe } from "./business-demo-data";
const KEY = "business-practice-v1";
const actor: SessionUser = {
  id: "cafe-practice-v1-importer",
  name: "ASSUMED practice setup",
  email: "practice-import@example.test",
  role: "ADMIN",
};
const profiles = [
  { profile: "MANAGER", employeeId: "cafe-demo-v1-staff-0" },
  { profile: "CASHIER", employeeId: "cafe-demo-v1-staff-4" },
  { profile: "WAITER", employeeId: "cafe-demo-v1-staff-6" },
  { profile: "CHEF", employeeId: "cafe-demo-v1-staff-1" },
] as const;
const csv = (values: unknown[]) =>
  values
    .map((v) => '"' + String(v ?? "").replaceAll('"', '""') + '"')
    .join(",");
const writeCsv = (
  dir: string,
  name: string,
  headers: string[],
  rows: unknown[][],
) =>
  writeFileSync(
    path.join(dir, name),
    "\uFEFF" + [csv(headers), ...rows.map(csv)].join("\r\n") + "\r\n",
    { mode: 0o600 },
  );
const day = (v: Date) => v.toISOString().slice(0, 10);
const note =
  "ASSUMED / TEST figures requested for checking the system; not actual cafe records.";
async function exportRecords(dir: string) {
  const sales = await prisma.businessSaleLine.findMany({
    where: { orderId: { startsWith: "cafe-demo-v1-order-" } },
    orderBy: [{ date: "asc" }, { productName: "asc" }],
  });
  const items = await prisma.orderItem.findMany({
    where: { orderId: { startsWith: "cafe-demo-v1-order-" } },
    select: { id: true, unitPrice: true },
  });
  const itemPrices = new Map(items.map((i) => [i.id, i.unitPrice]));
  const grouped = new Map<
    string,
    {
      date: string;
      item: string;
      qty: number;
      price: number;
      sale: bigint;
      cost: bigint;
    }
  >();
  for (const row of sales) {
    const date = day(row.date),
      price = itemPrices.get(row.orderItemKey) ?? 0,
      key = date + "|" + row.productName + "|" + price;
    const entry = grouped.get(key) ?? {
      date,
      item: row.productName,
      qty: 0,
      price,
      sale: 0n,
      cost: 0n,
    };
    entry.qty += row.quantity;
    entry.sale += paise(row.net);
    entry.cost += paise(row.cost);
    grouped.set(key, entry);
  }
  const saleRows = [...grouped.values()];
  writeCsv(
    dir,
    "Daily-Sales-Report.csv",
    [
      "Date",
      "Item",
      "Qty Sold",
      "Sale Price",
      "Total Sale",
      "Total Cost",
      "Profit",
      "Profit % (of cost)",
      "Margin % (of sales)",
      "Data source",
    ],
    saleRows.map((s) => [
      s.date,
      s.item,
      s.qty,
      s.price,
      decimal(s.sale),
      decimal(s.cost),
      decimal(s.sale - s.cost),
      s.cost ? decimal(divideRound((s.sale - s.cost) * 10000n, s.cost)) : "",
      s.sale ? decimal(divideRound((s.sale - s.cost) * 10000n, s.sale)) : "",
      note,
    ]),
  );
  const staff = await prisma.employee.findMany({
    where: { code: { startsWith: "DEMO-" } },
    include: { party: true },
    orderBy: { code: "asc" },
  });
  writeCsv(
    dir,
    "Staff-Salaries.csv",
    [
      "Employee code",
      "Name",
      "Designation",
      "Pay basis",
      "Salary / daily rate",
      "Overtime per hour",
      "Joining date",
      "Data source",
    ],
    staff.map((s) => [
      s.code,
      s.party.name,
      s.designation,
      s.payBasis,
      s.basePay.toString(),
      s.overtimeRate.toString(),
      day(s.joinedOn),
      note,
    ]),
  );
  const stock = await prisma.ingredient.findMany({
    where: { id: { startsWith: "cafe-demo-v1-ingredient-" } },
    orderBy: { name: "asc" },
  });
  writeCsv(
    dir,
    "Ingredient-Stock.csv",
    [
      "Ingredient",
      "Unit",
      "Quantity",
      "Stock value",
      "Reorder level",
      "Data source",
    ],
    stock.map((i) => [
      i.name,
      i.unit,
      i.quantity.toString(),
      i.stockValue.toString(),
      i.reorderAt.toString(),
      note,
    ]),
  );
  const payroll = await prisma.payrollRecord.findMany({
    where: { employee: { code: { startsWith: "DEMO-" } } },
    include: { employee: { include: { party: true } } },
    orderBy: { startsOn: "asc" },
  });
  writeCsv(
    dir,
    "Payroll.csv",
    [
      "Employee",
      "From",
      "To",
      "Status",
      "Base pay",
      "Unpaid leave deduction",
      "Overtime",
      "Bonus",
      "Other deductions",
      "Advance recovered",
      "Earned pay",
      "Net payable",
      "Data source",
    ],
    payroll.map((p) => [
      p.employee.party.name,
      day(p.startsOn),
      day(p.endsOn),
      p.status,
      p.basePay.toString(),
      p.unpaidDeduction.toString(),
      p.overtimePay.toString(),
      p.bonus.toString(),
      p.manualDeduction.toString(),
      p.advanceApplied.toString(),
      p.earnedPay.toString(),
      p.netPay.toString(),
      note,
    ]),
  );
  const attendance = await prisma.attendance.findMany({
    where: { employee: { code: { startsWith: "DEMO-" } } },
    include: { employee: { include: { party: true } } },
    orderBy: [{ date: "asc" }, { employeeId: "asc" }],
  });
  writeCsv(
    dir,
    "Attendance.csv",
    ["Date", "Employee", "Status", "Overtime hours", "Data source"],
    attendance.map((a) => [
      day(a.date),
      a.employee.party.name,
      a.status,
      a.overtimeHours.toString(),
      note,
    ]),
  );
  const purchases = await prisma.businessPurchase.findMany({
    where: { invoiceNumber: { startsWith: "DEMO-" } },
    include: { supplier: true, lines: { include: { ingredient: true } } },
    orderBy: { date: "asc" },
  });
  writeCsv(
    dir,
    "Purchases.csv",
    [
      "Date",
      "Invoice",
      "Supplier",
      "Ingredient",
      "Quantity",
      "Total cost",
      "Returned quantity",
      "Returned value",
      "Data source",
    ],
    purchases.flatMap((p) =>
      p.lines.map((l) => [
        day(p.date),
        p.invoiceNumber,
        p.supplier.name,
        l.ingredient.name,
        l.quantity.toString(),
        l.totalCost.toString(),
        l.returnedQuantity.toString(),
        l.returnedCost.toString(),
        note,
      ]),
    ),
  );
  const expense = await prisma.businessJournal.findMany({
    where: { actorId: "cafe-demo-v1-actor-1", source: "EXPENSE" },
    include: { postings: { include: { account: true } } },
    orderBy: { date: "asc" },
  });
  writeCsv(
    dir,
    "Expenses.csv",
    ["Date", "Category", "Amount", "Description", "Data source"],
    expense.flatMap((j) =>
      j.postings
        .filter((p) => p.account.kind === "EXPENSE")
        .map((p) => [
          day(j.date),
          p.account.name,
          p.debit.toString(),
          j.note,
          note,
        ]),
    ),
  );
  const totals = saleRows.reduce(
    (s, r) => ({
      qty: s.qty + r.qty,
      sale: s.sale + r.sale,
      cost: s.cost + r.cost,
    }),
    { qty: 0, sale: 0n, cost: 0n },
  );
  writeCsv(
    dir,
    "Summary.csv",
    ["Metric", "Value", "Data source"],
    [
      ["Units sold", totals.qty, note],
      ["Food sales", decimal(totals.sale), note],
      ["Food cost", decimal(totals.cost), note],
      ["Gross profit", decimal(totals.sale - totals.cost), note],
      [
        "Gross profit / cost %",
        totals.cost
          ? decimal(
              divideRound((totals.sale - totals.cost) * 10000n, totals.cost),
            )
          : "",
        note,
      ],
      ["Date rule", "Accounting dates follow each synthetic order date", note],
    ],
  );
  writeFileSync(
    path.join(dir, "README.txt"),
    note +
      "\nDaily-Sales-Report.csv uses the same core columns as the supplied example. Profit % is profit divided by cost; margin is shown separately. CSV files open in Excel.\n",
    { mode: 0o600 },
  );
  return {
    salesRows: saleRows.length,
    files: [
      "Daily-Sales-Report.csv",
      "Staff-Salaries.csv",
      "Ingredient-Stock.csv",
      "Payroll.csv",
      "Attendance.csv",
      "Purchases.csv",
      "Expenses.csv",
      "Summary.csv",
    ],
  };
}
export async function seedBusinessPractice(apply = false) {
  if (!apply) {
    console.log(
      "Preview: load the 600 assumed orders if absent, link missing normal-menu recipes to assumed stock, provision four limited staff test accounts and a separate practice till, and export Excel-compatible reports. Existing menu prices/photos, existing passwords and configured recipes stay unchanged.",
    );
    return;
  }
  await seedBusinessDemo(true);
  const dir = path.resolve(
    process.env.CAFE_PRACTICE_OUTPUT ??
      path.join("/tmp", "cafe-practice-" + Date.now()),
  );
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const existing = await prisma.businessRequest.findUnique({
    where: { key: KEY },
  });
  if (existing) {
    console.log(
      "Practice setup already exists; no duplicate users, float or recipes added.",
    );
    const oldFile = (existing.result as { credentialsFile?: string })
      .credentialsFile;
    if (oldFile && !existsSync(oldFile)) {
      const originalPending = path.join(
        path.dirname(oldFile),
        "practice-logins.pending.txt",
      );
      if (existsSync(originalPending)) renameSync(originalPending, oldFile);
    }
    const newFile = path.join(dir, "practice-logins.txt");
    if (oldFile && existsSync(oldFile) && path.resolve(oldFile) !== newFile) {
      copyFileSync(oldFile, newFile);
      chmodSync(newFile, 0o600);
    }
    const exports = await exportRecords(dir);
    console.log(
      JSON.stringify(
        { setup: existing.result, reportDirectory: dir, ...exports },
        null,
        2,
      ),
    );
    return existing.result;
  }
  const credentials = profiles.map((p) => ({
    ...p,
    email: p.profile.toLowerCase() + ".practice@example.test",
    password: randomBytes(14).toString("base64url"),
  }));
  const hashed = await Promise.all(
    credentials.map(async (c) => ({
      ...c,
      passwordHash: await bcrypt.hash(c.password, 12),
    })),
  );
  const pending = path.join(dir, "practice-logins.pending.txt");
  const result = await prisma.$transaction(
    async (tx) => {
      await businessLock(tx);
      await ensureBusiness(tx);
      const prior = await tx.businessRequest.findUnique({
        where: { key: KEY },
      });
      if (prior) return prior.result;
      const originalMenu = await tx.product.findMany({
        where: { id: { not: { startsWith: "cafe-demo-v1-product-" } } },
        include: { recipe: true },
      });
      const ingredients = await tx.ingredient.findMany({
        where: { id: { startsWith: "cafe-demo-v1-ingredient-" } },
      });
      const ingredientMap = new Map(
        ingredients.map((i) => [i.name.replace(/^DEMO · /, ""), i.id]),
      );
      let recipesAdded = 0,
        addonsAdded = 0;
      for (const p of originalMenu) {
        if (p.recipe || !p.recipeRequired) continue;
        await tx.recipe.create({
          data: {
            productId: p.id,
            yieldUnits: "1",
            note,
            lines: { create: assumedRecipe(p.name, ingredientMap) },
          },
        });
        recipesAdded++;
      }
      const addons = await tx.productAddon.findMany({
        where: { isAvailable: true, recipe: null },
      });
      for (const addon of addons) {
        const n = addon.name.toLowerCase();
        if (/no |without|less |regular|normal|standard/.test(n)) continue;
        const rule = /chicken/.test(n)
          ? ["Chicken", "40"]
          : /cheese|cheez/.test(n)
            ? ["Cheese", "20"]
            : /egg|anda/.test(n)
              ? ["Eggs", "1"]
              : /milk/.test(n)
                ? ["Milk", "40"]
                : /badam|almond/.test(n)
                  ? ["Almonds", "3"]
                  : /pistach/.test(n)
                    ? ["Pistachio", "2"]
                    : /ghee|butter|oil/.test(n)
                      ? ["Cooking oil", "8"]
                      : /sugar/.test(n)
                        ? ["Sugar", "10"]
                        : null;
        if (!rule) continue;
        await tx.recipe.create({
          data: {
            addonId: addon.id,
            yieldUnits: "1",
            note,
            lines: {
              create: [
                {
                  ingredientId: ingredientMap.get(rule[0])!,
                  quantity: rule[1],
                },
              ],
            },
          },
        });
        addonsAdded++;
      }
      const accounts = [];
      const savedCredentials = [];
      for (const c of hashed) {
        const employee = await tx.employee.findUniqueOrThrow({
          where: { id: c.employeeId },
          include: { access: true, party: true },
        });
        if (employee.access) {
          accounts.push({
            profile: c.profile,
            email: "Existing employee login retained",
            created: false,
          });
          continue;
        }
        const user = await tx.user.create({
          data: {
            id: "cafe-practice-v1-user-" + c.profile.toLowerCase(),
            name: employee.party.name,
            email: c.email,
            passwordHash: c.passwordHash,
            role: "STAFF",
          },
        });
        await tx.staffAccess.create({
          data: {
            userId: user.id,
            employeeId: employee.id,
            profile: c.profile,
          },
        });
        accounts.push({
          profile: c.profile,
          email: user.email,
          userId: user.id,
          created: true,
        });
        savedCredentials.push(c);
      }
      writeFileSync(
        pending,
        [
          note,
          "These are limited STAFF test accounts. Existing admin login was not changed.",
          "",
          ...savedCredentials.map(
            (c) => `${c.profile}\nEmail: ${c.email}\nPassword: ${c.password}\n`,
          ),
        ].join("\n"),
        { mode: 0o600 },
      );
      const cashier = accounts.find(
        (a) => a.profile === "CASHIER" && a.created,
      );
      let practiceDrawer: string | null = null;
      if (cashier) {
        const bank = await tx.businessAccount.findUniqueOrThrow({
          where: { code: "DEMO_BANK" },
        });
        const account = await tx.businessAccount.create({
          data: {
            id: "cafe-practice-v1-cash-account",
            code: "PRACTICE_CASH",
            name: "ASSUMED · Practice counter",
            kind: "ASSET",
            isMoney: true,
          },
        });
        const drawer = await tx.cashDrawer.create({
          data: {
            id: "cafe-practice-v1-drawer",
            name: "ASSUMED · Cashier practice till",
            accountId: account.id,
          },
        });
        const cashierActor: SessionUser = {
          id: cashier.userId!,
          name: "ASSUMED practice cashier",
          email: cashier.email,
          role: "STAFF",
          businessProfile: "CASHIER",
        };
        await cashAction(tx, cashierActor, {
          requestId: "cafe-practice-v1-open-shift",
          action: "OPEN",
          drawerId: drawer.id,
          amount: "0.00",
          note,
        });
        assert.ok(
          (await accountBalance(tx, bank.id)) >= 2000000n,
          "Not enough assumed bank funds for practice float",
        );
        await moneyAction(tx, actor, {
          requestId: "cafe-practice-v1-float",
          kind: "TRANSFER",
          amount: "20000.00",
          accountId: bank.id,
          toAccountId: account.id,
          date: businessToday(),
          note,
        });
        practiceDrawer = drawer.name;
      }
      const legacy = await tx.order.findMany({
        where: {
          businessTracked: false,
          status: { notIn: ["DELIVERED", "CANCELLED"] },
        },
        select: { orderNumber: true, status: true },
        take: 20,
      });
      const legacyCount = await tx.order.count({
        where: {
          businessTracked: false,
          status: { notIn: ["DELIVERED", "CANCELLED"] },
        },
      });
      const readiness = await stockReadiness(tx);
      let config = await tx.businessConfig.findUniqueOrThrow({
        where: { id: 1 },
      });
      if (!config.enabled && !legacyCount && readiness.ready) {
        await businessAction(tx, actor, "setup", {
          action: "CONFIG",
          requestId: "69f0fddd-2cef-47a5-b968-c46b9c595405",
          enabled: true,
          note,
        });
        config = await tx.businessConfig.findUniqueOrThrow({
          where: { id: 1 },
        });
      }
      const result = {
        assumed: true,
        recipesAdded,
        addonRecipesAdded: addonsAdded,
        testAccounts: accounts,
        practiceDrawer,
        accountingActive: config.enabled,
        legacyOpenCount: legacyCount,
        legacyOpenOrders: legacy,
        missingRecipes: readiness.missingRecipes,
        credentialsFile: path.join(dir, "practice-logins.txt"),
        note,
      };
      await audit(
        tx,
        actor,
        "SETUP_ASSUMED_PRACTICE",
        "PracticeDataset",
        KEY,
        result,
      );
      await tx.businessRequest.create({
        data: { key: KEY, payloadHash: "assumed-practice-v1", result },
      });
      return result;
    },
    { timeout: 60000, maxWait: 10000 },
  );
  if (existsSync(pending))
    renameSync(pending, path.join(dir, "practice-logins.txt"));
  const exports = await exportRecords(dir);
  console.log(
    "PASS: assumed practice setup complete. Passwords were saved only in the private credentials file.",
  );
  console.log(
    JSON.stringify(
      { setup: result, reportDirectory: dir, ...exports },
      null,
      2,
    ),
  );
  return result;
}

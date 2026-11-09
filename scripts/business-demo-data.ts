/** Synthetic training data, explicitly requested inside the existing cafe.
 * Existing users, products, recipes, orders and integration settings are preserved.
 * Run only through business-demo.cjs / load-business-demo.sh.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  businessToday,
  dateValue,
  decimal,
  paise,
  quantity,
} from "@/lib/business-math";
import type { SessionUser } from "@/lib/types";
import {
  businessLock,
  ensureBusiness,
  journal,
  accountBalance,
  audit,
  type DB,
} from "@/server/business/core";
import {
  adjustIngredient,
  reserveOrder,
  consumeOrder,
} from "@/server/business/inventory";
import {
  invoiceOrder,
  receiveOrderMoney,
  voidBusinessOrder,
} from "@/server/business/order-ledger";
import {
  postPurchase,
  returnPurchase,
  payParty,
} from "@/server/business/purchases";
import { moneyAction, cashAction } from "@/server/business/cash";
import { draftPayroll, postPayroll } from "@/server/business/payroll";
import { seedDemoExtras } from "./demo-extra-data";
import {
  accrueDelivery,
  reverseDelivery,
  deliveryAction,
  riderCash,
} from "@/server/business/delivery";
import type { SeedProduct } from "../prisma/seed-data";
const { PRODUCTS } = createRequire(process.cwd() + "/package.json")(
  "./prisma/seed-data.ts",
) as { PRODUCTS: Record<string, SeedProduct[]> };
const P = "DEMO · ";
const digest = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const addDays = (date: string, days: number) =>
  new Date(dateValue(date).getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);
const stamp = (date: string, hour = 12, minute = 0) =>
  new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:00`,
  );
const INGREDIENTS_BASE = [
  ["Milk", "ML", "500000", "110000", "15000"],
  ["Tea leaves", "G", "16000", "24000", "500"],
  ["Flour", "G", "500000", "65000", "15000"],
  ["Cooking oil", "ML", "40000", "20000", "2000"],
  ["Sugar", "G", "60000", "10200", "2500"],
  ["Salt", "G", "10000", "1200", "500"],
  ["Potato", "G", "120000", "14400", "5000"],
  ["Chicken", "G", "160000", "112000", "5000"],
  ["Cheese", "G", "35000", "49000", "2000"],
  ["Coffee", "G", "10000", "30000", "500"],
  ["Eggs", "PCS", "1500", "45000", "100"],
  ["Burger buns", "PCS", "900", "22500", "50"],
  ["Tomato", "G", "35000", "5600", "1000"],
  ["Onion", "G", "35000", "4200", "1000"],
  ["Yogurt", "ML", "30000", "9000", "1500"],
  ["Ketchup", "G", "10000", "5000", "500"],
  ["Almonds", "G", "8000", "22400", "300"],
  ["Pistachio", "G", "6000", "21600", "300"],
  ["Jaggery", "G", "15000", "4500", "500"],
  ["Green tea", "G", "4000", "9600", "200"],
  ["Cardamom", "G", "1500", "9000", "100"],
  ["Lemon", "PCS", "24", "360", "35"],
  ["Fresh mint", "G", "150", "120", "500"],
  ["Takeaway cups", "PCS", "500", "3000", "600"],
] as const;
const TEAM_BASE = [
  ["Ahmed Raza", "Cafe manager", "42000"],
  ["Bilal Hassan", "Head chef", "39000"],
  ["Usman Ali", "Paratha chef", "34000"],
  ["Danish Khan", "Tea specialist", "29000"],
  ["Faisal Iqbal", "Cashier", "28000"],
  ["Hamza Aslam", "Cashier", "27000"],
  ["Saad Ahmed", "Waiter", "24000"],
  ["Ali Hamza", "Waiter", "23000"],
  ["Hassan Tariq", "Waiter", "24000"],
  ["Farhan Malik", "Delivery rider", "25000"],
  ["Imran Shah", "Kitchen helper", "22000"],
  ["Zain Abbas", "Cleaner", "21000"],
] as const;
const NAMES = [
  "Ayesha Khan",
  "Mariam Ali",
  "Sara Ahmed",
  "Hira Aslam",
  "Fatima Noor",
  "Zoya Malik",
  "Ahmed Iqbal",
  "Umar Farooq",
  "Hassan Raza",
  "Ali Haider",
  "Usman Shah",
  "Bilal Tariq",
  "Hamza Noor",
  "Saad Khan",
  "Zain Ali",
];
/** Only the synthetic import uses this date adapter. All calculations, reservations,
 * postings, constraints and reversals still use the real accounting services.
 * Original insert time remains in the journal/audit; accounting dates match the
 * synthetic historical activity rather than every sample appearing today.
 */
function dated(
  tx: DB,
  day: string,
  lockedThrough: Date | null,
  time = stamp(day),
): DB {
  const date = dateValue(day);
  assert.ok(day <= businessToday(), "Demo entry cannot be dated in the future");
  assert.ok(
    !lockedThrough || date > lockedThrough,
    "Demo entry cannot change a closed period",
  );
  const models = new Map<PropertyKey, unknown>();
  return new Proxy(tx, {
    get(target, model) {
      if (
        ![
          "businessJournal",
          "businessSaleLine",
          "order",
          "ingredientReservation",
          "stockMovement",
          "cashShift",
        ].includes(String(model))
      )
        return Reflect.get(target, model);
      if (models.has(model)) return models.get(model);
      const delegate = Reflect.get(target, model);
      const proxy = new Proxy(delegate, {
        get(object, action) {
          const fn = Reflect.get(object, action);
          if (!["create", "update", "updateMany"].includes(String(action)))
            return typeof fn === "function" ? fn.bind(object) : fn;
          return (args: { data: Record<string, unknown> }) => {
            const data = { ...args.data };
            if (
              (model === "businessJournal" || model === "businessSaleLine") &&
              action === "create"
            )
              data.date = date;
            if (model === "businessJournal" && action === "create")
              data.note =
                P +
                String(data.note ?? "Training transaction").replace(
                  /^DEMO · /,
                  "",
                );
            if (model === "stockMovement" && action === "create")
              data.createdAt = time;
            for (const key of [
              "businessConsumedAt",
              "businessInvoicedAt",
              "businessVoidedAt",
              "consumedAt",
              "releasedAt",
              "closedAt",
            ])
              if (data[key] instanceof Date) data[key] = time;
            return fn.call(object, { ...args, data });
          };
        },
      });
      models.set(model, proxy);
      return proxy;
    },
  });
}
function recipe(name: string, ingredients: Map<string, string>) {
  const n = name.toLowerCase();
  const lines: Record<string, string> = {};
  if (/chai|tea|coffee|qehwa/.test(n)) {
    lines[
      /coffee/.test(n)
        ? "Coffee"
        : /sabz|green/.test(n)
          ? "Green tea"
          : "Tea leaves"
    ] = /kettli|kettle/.test(n) ? "10" : "4";
    if (!/sulemani|sabz|green|black/.test(n))
      lines.Milk = /kettli|kettle/.test(n) ? "400" : "160";
    lines[/gur/.test(n) ? "Jaggery" : "Sugar"] = "10";
    if (/badam|kashmiri/.test(n)) lines.Almonds = "3";
    if (/kashmiri/.test(n)) lines.Pistachio = "2";
  } else if (/paratha|pizza/.test(n)) {
    lines.Flour = "110";
    lines["Cooking oil"] = "10";
    lines.Salt = "1";
    if (/aloo|potato/.test(n)) lines.Potato = "80";
    if (/chicken|pizza/.test(n)) lines.Chicken = "65";
    if (/cheese|cheez|pizza/.test(n)) lines.Cheese = "25";
    if (/sweet|meetha/.test(n)) lines.Sugar = "20";
  } else if (/anda|egg|omelette/.test(n)) {
    lines.Eggs = "2";
    lines["Cooking oil"] = "8";
    lines.Onion = "15";
  } else {
    lines.Flour = "80";
    lines["Cooking oil"] = "8";
    lines.Potato = "30";
  }
  return Object.entries(lines).map(([name, qty]) => ({
    ingredientId: ingredients.get(name)!,
    quantity: qty,
  }));
}
export async function seedBusinessDemo(
  apply = false,
  options?: {
    jobId: string;
    before?: (tx: DB) => Promise<void>;
    complete?: (tx: DB, result: any) => Promise<void>;
  },
) {
  const bulk = Boolean(options);
  const KEY = bulk ? "business-demo-v2" : "business-demo-v1";
  const P = bulk ? "DEMO 2 · " : "DEMO · ";
  const id = (type: string, n: string | number) =>
    `cafe-demo-${bulk ? "v2" : "v1"}-${type}-${n}`;
  const actor: SessionUser = {
    id: id("actor", 1),
    name: P + "data importer",
    email: "demo-import@example.test",
    role: "ADMIN",
  };
  const targetOrders = bulk ? 2000 : 600;
  const prefix = bulk ? "DEMO2" : "DEMO";
  const slug = bulk ? "demo-training-v2" : "demo-training";
  const TEAM = bulk
    ? Array.from({ length: 30 }, (_, i) => [
        TEAM_BASE[i % TEAM_BASE.length][0] +
          " " +
          (Math.floor(i / TEAM_BASE.length) + 1),
        TEAM_BASE[i % TEAM_BASE.length][1],
        TEAM_BASE[i % TEAM_BASE.length][2],
      ])
    : TEAM_BASE;
  const INGREDIENTS = bulk
    ? [
        ...INGREDIENTS_BASE,
        ...Array.from(
          { length: 16 },
          (_, i) =>
            ["Pantry sample " + (i + 1), "G", "10000", "1000", "100"] as const,
        ),
      ]
    : INGREDIENTS_BASE;
  const dbInfo = (
    await prisma.$queryRaw<
      { name: string }[]
    >`SELECT current_database()::text AS name`
  )[0];
  assert.ok(
    [
      "engineer_cafe",
      "cafe_business_test",
      "cafe_demo_seed_test",
      "cafe_demo_cleanup_test",
    ].includes(dbInfo.name),
    "Unexpected database; demo import stopped.",
  );
  const prior = await prisma.businessRequest.findUnique({
    where: { key: KEY },
  });
  if (prior) {
    console.log("DEMO data already exists. No duplicates were added.");
    console.log(JSON.stringify(prior.result, null, 2));
    return prior.result;
  }
  if (!apply) {
    console.log(
      "Preview: 600 clearly marked demo orders, 24 ingredients, 24 products, 12 staff, attendance, payroll, suppliers, purchases, expenses and table bills. Existing business records are preserved. Demo transactions count in reports. Pass --apply after a database backup.",
    );
    return;
  }
  const demoPasswordHash = await bcrypt.hash(
    randomBytes(32).toString("hex"),
    12,
  );
  return prisma.$transaction(
    async (raw) => {
      await businessLock(raw);
      if (options) {
        await raw.$queryRaw`SELECT set_config('cafe.demo_job',${options.jobId},true)`;
        await raw.$queryRaw`SELECT set_config('cafe.demo_batch','business-demo-v2',true)`;
        await options.before?.(raw);
      }
      await ensureBusiness(raw);
      const existing = await raw.businessRequest.findUnique({
        where: { key: KEY },
      });
      if (existing) return existing.result;
      const config = await raw.businessConfig.findUniqueOrThrow({
        where: { id: 1 },
      });
      const today = businessToday();
      let start = addDays(today, -29);
      if (config.lockedThrough) {
        const open = addDays(
          config.lockedThrough.toISOString().slice(0, 10),
          1,
        );
        if (open > start) start = open;
      }
      assert.ok(
        start <= today,
        "The current accounting date is closed. Demo loading needs an open accounting date.",
      );
      const days =
        Math.round(
          (dateValue(today).getTime() - dateValue(start).getTime()) / 86400000,
        ) + 1;
      const first = dated(raw, start, config.lockedThrough);
      const protectedProducts = await raw.product.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          price: true,
          image: true,
          stock: true,
          soldCount: true,
          isAvailable: true,
          categoryId: true,
        },
      });
      const protectedOrders = await raw.order.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          status: true,
          total: true,
          amountPaid: true,
          amountRefunded: true,
          updatedAt: true,
        },
      });
      const realUsers = await raw.user.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          passwordHash: true,
        },
      });
      const stockBefore =
        (await raw.ingredient.aggregate({ _sum: { stockValue: true } }))._sum
          .stockValue ?? 0;
      const inventoryBefore = await accountBalance(raw, "INVENTORY");
      const wipBefore = await accountBalance(raw, "WIP");
      const realMoney = await raw.businessAccount.findMany({
        where: { isMoney: true },
        select: { id: true },
      });
      const moneyBefore = new Map<string, bigint>();
      for (const a of realMoney)
        moneyBefore.set(a.id, await accountBalance(raw, a.id));
      for (const [model, where] of [
        ["ingredient", { name: { startsWith: P } }],
        ["employee", { code: { startsWith: prefix + "-" } }],
        ["category", { slug: slug + "-menu" }],
      ] as const) {
        const delegate = raw[model] as unknown as {
          count: (args: { where: unknown }) => Promise<number>;
        };
        assert.equal(
          await delegate.count({ where }),
          0,
          "Unmarked partial demo data exists. Inspect before importing.",
        );
      }
      console.log(
        `Loading DEMO data for ${start} through ${today}. All entries are in one transaction.`,
      );
      const accounts: Record<string, string> = {};
      for (const [code, name, kind] of [
        ["DEMO_CASH", "DEMO · Training cash", "ASSET"],
        ["DEMO_BANK", "DEMO · Training bank", "ASSET"],
        ["DEMO_WALLET", "DEMO · Training wallet", "ASSET"],
        ["DEMO_RIDER", "DEMO · Rider cash", "ASSET"],
      ] as const) {
        if (bulk && code === "DEMO_RIDER") continue;
        const account = await first.businessAccount.create({
          data: {
            id: id("account", code),
            code: bulk ? code.replace("DEMO_", "DEMO2_") : code,
            name: P + name.replace(/^DEMO · /, ""),
            kind,
            isMoney: true,
          },
        });
        accounts[code] = account.id;
      }
      const drawer = await first.cashDrawer.create({
        data: {
          id: id("drawer", 1),
          name: P + "Training counter",
          accountId: accounts.DEMO_CASH,
        },
      });
      for (const [code, amount] of [
        ["DEMO_CASH", "200000"],
        ["DEMO_BANK", "1800000"],
        ["DEMO_WALLET", "100000"],
      ] as const)
        await journal(first, actor, {
          key: id("opening", code),
          source: "OPENING",
          sourceId: KEY,
          note: P + "Illustrative opening funds",
          date: start,
          lines: [
            { accountId: accounts[code], debit: paise(amount) },
            { code: "OPENING_EQUITY", credit: paise(amount) },
          ],
        });
      const ingredients = new Map<string, string>();
      for (const [name, unit, qty, value, reorder] of INGREDIENTS) {
        const item = await first.ingredient.create({
          data: {
            id: id("ingredient", name.toLowerCase().replaceAll(" ", "-")),
            name: P + name,
            unit,
            reorderAt: reorder,
          },
        });
        ingredients.set(name, item.id);
        await adjustIngredient(first, actor, {
          requestId: id("stock", name),
          ingredientId: item.id,
          kind: "OPENING",
          quantity: bulk ? decimal(quantity(qty) * 6n, 4) : qty,
          value: bulk ? decimal(paise(value) * 6n) : value,
          note: P + "Synthetic opening stock; not a physical count",
          date: start,
        });
      }
      const category = await first.category.create({
        data: {
          id: id("category", 1),
          name: P + "Training menu",
          slug: slug + "-menu",
          description:
            "Synthetic accounting examples; excluded from the public menu.",
          isActive: false,
          sortOrder: 999,
        },
      });
      const catalogue = await first.product.findMany({
        where: {
          categoryId: { not: category.id },
          ...(bulk ? { category: { isActive: true } } : {}),
        },
        orderBy: { sortOrder: "asc" },
        select: {
          name: true,
          description: true,
          price: true,
          image: true,
          urduName: true,
        },
        take: 24,
      });
      const fallback = Object.values(PRODUCTS).flat();
      const menu = [
        ...catalogue,
        ...fallback.filter((p) => !catalogue.some((c) => c.name === p.name)),
      ].slice(0, 24);
      const products = [];
      for (let i = 0; i < menu.length; i++) {
        const p = menu[i];
        const product = await first.product.create({
          data: {
            id: id("product", i),
            name: P + p.name,
            slug: slug + "-" + i,
            description: "DEMO only · " + p.description,
            price: p.price,
            image: p.image,
            urduName: p.urduName,
            categoryId: category.id,
            isAvailable: true,
            recipeRequired: true,
            sortOrder: i,
          },
        });
        await first.recipe.create({
          data: {
            productId: product.id,
            yieldUnits: "1",
            note:
              P + "Illustrative training recipe, not the cafe’s real recipe.",
            lines: { create: recipe(p.name, ingredients) },
          },
        });
        products.push(product);
      }
      const suppliers = [];
      for (let i = 0; i < (bulk ? 12 : 7); i++)
        suppliers.push(
          await first.businessParty.create({
            data: {
              id: id("supplier", i),
              kind: "SUPPLIER",
              name:
                P +
                [
                  "Islamabad Dairy",
                  "Fresh Poultry Supply",
                  "Flour & Grain Traders",
                  "Vegetable Market",
                  "Tea & Coffee Merchants",
                  "Packaging Depot",
                  "Dry Fruit House",
                ][i % 7] +
                (bulk ? " " + (i + 1) : ""),
              email: `${prefix.toLowerCase()}-supplier-${i}@example.test`,
              address: "DEMO supplier address",
            },
          }),
        );
      const customers = [];
      for (let i = 0; i < (bulk ? 100 : 45); i++) {
        const name =
          P +
          NAMES[i % NAMES.length] +
          " " +
          (Math.floor(i / NAMES.length) + 1);
        const email = `${prefix.toLowerCase()}-customer-${i}@example.test`;
        const user = await first.user.create({
          data: {
            id: id("customer-user", i),
            name,
            email,
            passwordHash: demoPasswordHash,
            role: "CUSTOMER",
          },
        });
        customers.push(
          await first.businessParty.create({
            data: {
              id: id("customer", i),
              kind: "CUSTOMER",
              name,
              email,
              userId: user.id,
              creditLimit: "15000",
            },
          }),
        );
      }
      const employees = [];
      for (let i = 0; i < TEAM.length; i++) {
        const [name, designation, salary] = TEAM[i];
        const party = await first.businessParty.create({
          data: {
            id: id("staff-party", i),
            kind: "EMPLOYEE",
            name: P + name,
            email: `${prefix.toLowerCase()}-staff-${i}@example.test`,
          },
        });
        employees.push(
          await first.employee.create({
            data: {
              id: id("staff", i),
              code: prefix + "-" + String(i + 1).padStart(3, "0"),
              partyId: party.id,
              designation,
              payBasis: i === 11 ? "DAILY" : "MONTHLY",
              basePay: i === 11 ? "800" : salary,
              overtimeRate: "150",
              joinedOn: dateValue(start),
              notes:
                P +
                "Synthetic employee; no login account or real phone number.",
            },
          }),
        );
      }
      const attendance: Prisma.AttendanceCreateManyInput[] = [];
      for (let d = 0; d < days; d++) {
        const day = addDays(start, d);
        for (let e = 0; e < employees.length; e++) {
          const status =
            (d + e) % 19 === 0
              ? "ABSENT"
              : (d + e) % 17 === 0
                ? "HALF_DAY"
                : (d + e) % 13 === 0
                  ? "PAID_LEAVE"
                  : "PRESENT";
          attendance.push({
            id: id("attendance", `${d}-${e}`),
            employeeId: employees[e].id,
            date: dateValue(day),
            status,
            overtimeHours:
              status === "PRESENT" && (d + e) % 7 === 0 ? "1.5" : "0",
            clockIn: status === "PRESENT" ? stamp(day, 9) : null,
            clockOut: status === "PRESENT" ? stamp(day, 18) : null,
            notes: P + "Training attendance",
            recordedBy: actor.name,
          });
        }
      }
      await first.attendance.createMany({ data: attendance });
      for (let e = 0; e < 6; e++)
        await payParty(first, actor, {
          requestId: id("advance", e),
          kind: "STAFF_ADVANCE",
          partyId: employees[e].partyId,
          amount: String(2000 + e * 250),
          accountId: accounts.DEMO_BANK,
          date: start,
          note: P + "Salary advance example",
        });
      const tables = [];
      for (let t = 0; t < (bulk ? 15 : 8); t++)
        tables.push(
          await first.cafeTable.create({
            data: {
              id: id("table", t),
              name:
                P +
                [
                  "Garden 1",
                  "Garden 2",
                  "Indoor 1",
                  "Indoor 2",
                  "Window 1",
                  "Family 1",
                  "Terrace 1",
                  "Takeaway desk",
                ][t % 8] +
                (bulk ? " " + (t + 1) : ""),
              seats: t === 5 ? 6 : 4,
            },
          }),
        );
      const riders = [];
      if (bulk)
        for (let n = 0; n < 25; n++) {
          const party = await first.businessParty.create({
            data: {
              id: id("rider-party", n),
              kind: "RIDER",
              name: P + "Rider " + (n + 1),
              email: `demo2-rider-${n}@example.test`,
            },
          });
          riders.push(
            await first.deliveryRider.create({
              data: {
                id: id("rider", n),
                code: "DEMO2-R" + String(n + 1).padStart(3, "0"),
                partyId: party.id,
              },
            }),
          );
        }
      let purchases = 0,
        returns = 0,
        expenses = 0,
        orders = 0,
        served = 0,
        cancelled = 0;
      let shiftId = "";
      for (let d = 0; d < days; d++) {
        const day = addDays(start, d);
        const tx = dated(raw, day, config.lockedThrough);
        const now = day === today;
        const opening = await accountBalance(tx, accounts.DEMO_CASH);
        const shift = await tx.cashShift.create({
          data: {
            id: id("shift", d),
            drawerId: drawer.id,
            openedById: actor.id,
            openedByName: "DEMO cashier",
            openingCash: decimal(opening),
            openedAt: stamp(day, 8),
          },
        });
        shiftId = shift.id;
        if (d % 3 === 0) {
          const targets = [
            INGREDIENTS[(d * 3) % 20],
            INGREDIENTS[(d * 3 + 1) % 20],
            INGREDIENTS[(d * 3 + 2) % 20],
          ];
          for (let p = 0; p < 3; p++) {
            const ing = targets[p];
            const qty = quantity(ing[2]) / 10n;
            const cost = paise(ing[3]) / 10n;
            const paid = p === 0 ? cost : p === 1 ? cost / 2n : 0n;
            const invoice = await postPurchase(tx, actor, {
              requestId: id("purchase", purchases),
              supplierId: suppliers[(d + p) % suppliers.length].id,
              invoiceNumber:
                prefix + "-INV-" + String(++purchases).padStart(3, "0"),
              date: day,
              note: P + "Training supplier delivery",
              lines: [
                {
                  ingredientId: ingredients.get(ing[0])!,
                  quantity: decimal(qty, 4),
                  totalCost: decimal(cost),
                },
              ],
              paid: decimal(paid),
              accountId: accounts.DEMO_BANK,
            });
            if (p === 2 && d % 6 === 0) {
              await returnPurchase(tx, actor, {
                requestId: id("return", d),
                lineId: invoice.lines[0].id,
                quantity: decimal(qty / 10n, 4),
                note: P + "Supplier return example",
                date: day,
              });
              returns++;
            }
          }
        }
        if (d % 2 === 0) {
          await moneyAction(tx, actor, {
            requestId: id("expense", d),
            kind: "EXPENSE",
            amount: String(350 + (d % 5) * 150),
            accountId: d % 4 === 0 ? accounts.DEMO_BANK : accounts.DEMO_CASH,
            expenseCode: [
              "GAS",
              "ELECTRICITY",
              "PACKAGING",
              "DELIVERY_EXPENSE",
              "OTHER_EXPENSE",
            ][d % 5],
            date: day,
            note: P + "Operating expense example",
          });
          expenses++;
        }
        if (d === 0) {
          await moneyAction(tx, actor, {
            requestId: id("rent", 1),
            kind: "EXPENSE",
            amount: "18000",
            accountId: accounts.DEMO_BANK,
            expenseCode: "RENT",
            date: day,
            note: P + "Illustrative premises rent",
          });
          expenses++;
        }
        const perDay = Math.ceil(targetOrders / days);
        for (let j = 0; j < perDay && orders < targetOrders; j++) {
          const n = orders++;
          const latest = now && n >= targetOrders - 12;
          const state = latest
            ? (
                [
                  "PENDING",
                  "CONFIRMED",
                  "PREPARING",
                  "READY",
                  "OUT_FOR_DELIVERY",
                  "CANCELLED",
                ] as const
              )[j % 6]
            : n % 19 === 0
              ? "CANCELLED"
              : "DELIVERED";
          const dine = latest
            ? state !== "OUT_FOR_DELIVERY" && j % 2 === 0
            : n % 4 === 0;
          const delivery =
            state === "OUT_FOR_DELIVERY" || (!dine && n % (bulk ? 2 : 3) === 0);
          const placed = stamp(day, 9 + (j % 12), (j * 7) % 60);
          const operation = dated(
            raw,
            day,
            config.lockedThrough,
            new Date(placed.getTime() + 20 * 60000),
          );
          let session: Awaited<
            ReturnType<typeof raw.tableSession.create>
          > | null = null;
          if (dine)
            session = await operation.tableSession.create({
              data: {
                id: id("session", n),
                tableId: tables[n % tables.length].id,
                waiterId: employees[6 + (n % 3)].id,
                openedById: actor.id,
                guestCount: 2 + (n % 3),
                openedAt: placed,
              },
            });
          const lineCount = 2 + (n % 3);
          const lines = [];
          for (let k = 0; k < lineCount; k++) {
            const product = products[(n * 5 + k * 7) % products.length];
            const qty = 1 + ((n + k) % 3);
            lines.push({
              productId: product.id,
              productName: product.name,
              productSlug: product.slug,
              productImage: product.image,
              unitPrice: product.price,
              quantity: qty,
              addonsTotal: 0,
              lineTotal: product.price * qty,
              notes: P + "Training order item",
            });
          }
          const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
          const discount = n % 9 === 0 ? Math.min(50, subtotal) : 0;
          const deliveryFee = delivery ? 80 : 0;
          const total = subtotal - discount + deliveryFee;
          const credit = n % 11 === 0 || dine;
          let order = await operation.order.create({
            data: {
              id: id("order", n),
              orderNumber: prefix + String(1000 + n),
              requestKey: id("order-request", n),
              userId: customers[n % customers.length].userId,
              customerName: customers[n % customers.length].name,
              customerPhone: "",
              customerEmail: customers[n % customers.length].email,
              orderType: delivery ? "DELIVERY" : "PICKUP",
              serviceMode: dine
                ? "DINE_IN"
                : delivery
                  ? "DELIVERY"
                  : "TAKEAWAY",
              channel: delivery ? "WEB" : "POS",
              status: "CONFIRMED",
              paymentMethod: delivery ? "CASH_ON_DELIVERY" : "CASH_AT_COUNTER",
              riderId: delivery && bulk ? riders[n % riders.length].id : null,
              riderAssignedAt: delivery && bulk ? placed : null,
              addressLine: delivery
                ? P + "Practice address " + ((n % 20) + 1)
                : null,
              businessTracked: true,
              businessCredit: credit,
              businessPartyId: customers[n % customers.length].id,
              tableSessionId: session?.id,
              tableName: session ? tables[n % tables.length].name : null,
              waiterName: session ? P + TEAM[6 + (n % 3)][0] : null,
              cashShiftId: shift.id,
              instructions: P + "Synthetic data for demonstrating the system.",
              subtotal,
              discount,
              deliveryFee,
              tax: 0,
              total,
              createdAt: placed,
              placedAt: placed,
              confirmedAt: new Date(placed.getTime() + 2 * 60000),
              items: { create: lines },
              events: {
                create: [
                  {
                    status: "PENDING",
                    note: P + "Order received",
                    createdAt: placed,
                  },
                  {
                    status: "CONFIRMED",
                    note: P + "Order confirmed",
                    createdAt: new Date(placed.getTime() + 2 * 60000),
                  },
                ],
              },
            },
          });
          await reserveOrder(operation, order.id);
          if (state === "CANCELLED") {
            if (n % 2 === 0) {
              await consumeOrder(operation, actor, order.id);
            }
            if (latest || n % 3 === 0)
              await receiveOrderMoney(operation, actor, {
                orderId: order.id,
                amount: BigInt(total) * 100n,
                accountId: accounts.DEMO_BANK,
                requestId: id("deposit", n),
                note: P + "Example prepaid cancellation",
                date: day,
              });
            order = await operation.order.update({
              where: { id: order.id },
              data: {
                status: "CANCELLED",
                cancelReason: P + "Training cancellation",
              },
            });
            await voidBusinessOrder(
              operation,
              actor,
              order,
              P + "Training cancellation",
            );
            if (paise(order.amountPaid) > 0n)
              await receiveOrderMoney(operation, actor, {
                orderId: order.id,
                amount: paise(order.amountPaid) - (latest ? 100n : 0n),
                accountId: accounts.DEMO_BANK,
                requestId: id("refund", n),
                refund: true,
                note: P + "Actual refund example",
                date: day,
              });
            cancelled++;
          } else if (state === "DELIVERED") {
            await operation.order.update({
              where: { id: order.id },
              data: {
                status: "DELIVERED",
                readyAt: new Date(placed.getTime() + 12 * 60000),
                deliveredAt: new Date(placed.getTime() + 20 * 60000),
              },
            });
            await invoiceOrder(operation, actor, order.id);
            if (bulk && delivery)
              await accrueDelivery(operation, actor, order.id);
            const amount =
              credit && n % 2 === 0
                ? BigInt(total) * 50n
                : BigInt(total) * 100n;
            await receiveOrderMoney(operation, actor, {
              orderId: order.id,
              amount,
              accountId:
                delivery && bulk
                  ? (
                      await operation.businessAccount.findUniqueOrThrow({
                        where: { code: "RIDER_CASH" },
                      })
                    ).id
                  : n % 3 === 0
                    ? accounts.DEMO_BANK
                    : n % 3 === 1
                      ? accounts.DEMO_CASH
                      : accounts.DEMO_WALLET,
              requestId: id("receipt", n),
              note:
                P +
                (amount < BigInt(total) * 100n
                  ? "Partial credit payment"
                  : "Paid sale"),
              date: day,
            });
            served++;
            if (dine && amount < BigInt(total) * 100n)
              await receiveOrderMoney(operation, actor, {
                orderId: order.id,
                amount: BigInt(total) * 100n - amount,
                accountId: accounts.DEMO_BANK,
                requestId: id("split-receipt", n),
                note: P + "Second part of a split table payment",
                date: day,
              });
          } else {
            await operation.order.update({
              where: { id: order.id },
              data: { status: state },
            });
            if (["PREPARING", "READY", "OUT_FOR_DELIVERY"].includes(state)) {
              await consumeOrder(operation, actor, order.id);
            }
            if (state === "READY")
              await operation.order.update({
                where: { id: order.id },
                data: { readyAt: new Date(placed.getTime() + 15 * 60000) },
              });
            if (n % 2 === 0)
              await receiveOrderMoney(operation, actor, {
                orderId: order.id,
                amount: BigInt(total) * 50n,
                accountId: accounts.DEMO_BANK,
                requestId: id("open-deposit", n),
                note: P + "Part-paid open ticket",
                date: day,
              });
          }
          await operation.orderEvent.create({
            data: {
              orderId: order.id,
              status: state,
              note: P + "Current order status",
              createdAt: new Date(placed.getTime() + 20 * 60000),
            },
          });
          for (const line of lines)
            await operation.product.update({
              where: { id: line.productId! },
              data: {
                soldCount: {
                  increment: state === "CANCELLED" ? 0 : line.quantity,
                },
              },
            });
          if (session && !latest)
            await operation.tableSession.update({
              where: { id: session.id },
              data: { closedAt: new Date(placed.getTime() + 35 * 60000) },
            });
          if (orders % 50 === 0)
            console.log(`DEMO orders prepared: ${orders}/${targetOrders}`);
        }
        if (!now) {
          const expected = await accountBalance(tx, accounts.DEMO_CASH);
          await cashAction(
            dated(raw, day, config.lockedThrough, stamp(day, 23)),
            actor,
            {
              requestId: id("close", d),
              action: "CLOSE",
              shiftId: shift.id,
              amount: decimal(
                expected + (d % 7 === 0 ? -500n : d % 5 === 0 ? 1000n : 0n),
              ),
              note:
                P + "Counted closing cash; small training over/short example",
            },
          );
        }
      }
      console.log("Preparing DEMO payroll, stock usage and customer balances…");
      let payrolls = 0;
      const periodEnd = addDays(today, -1);
      if (periodEnd >= start) {
        const month = periodEnd.slice(0, 7);
        const periodStart = month + "-01" > start ? month + "-01" : start;
        for (let e = 0; e < employees.length; e++) {
          const tx = dated(raw, periodEnd, config.lockedThrough);
          const draft = await draftPayroll(tx, actor, {
            employeeId: employees[e].id,
            start: periodStart,
            end: periodEnd,
            bonus: e % 4 === 0 ? "500" : "0",
            deduction: e % 5 === 0 ? "200" : "0",
            recoverAdvance: e !== 5,
            note: P + "Salary calculation example",
          });
          if (e < 10) {
            await postPayroll(tx, actor, {
              id: draft.id,
              version: draft.updatedAt.toISOString(),
              acknowledgeAttendance: true,
            });
            if (e < 8 && paise(draft.netPay) > 0n)
              await payParty(dated(raw, today, config.lockedThrough), actor, {
                requestId: id("salary-payment", e),
                kind: "PAYROLL_PAYMENT",
                partyId: employees[e].partyId,
                payrollId: draft.id,
                amount: decimal(
                  e === 7 ? paise(draft.netPay) / 2n : paise(draft.netPay),
                ),
                accountId: accounts.DEMO_BANK,
                date: today,
                note: P + "Salary payment example",
              });
          }
          payrolls++;
        }
      }
      const current = dated(raw, today, config.lockedThrough);
      for (const [name, qty] of [
        ["Milk", "1000"],
        ["Flour", "500"],
        ["Potato", "300"],
      ] as const)
        await adjustIngredient(current, actor, {
          requestId: id("waste", name),
          ingredientId: ingredients.get(name)!,
          kind: name === "Potato" ? "STAFF_MEAL" : "WASTE",
          quantity: qty,
          note:
            P +
            (name === "Potato"
              ? "Staff meal consumption"
              : "Recorded spoilage"),
          date: today,
        });
      if (bulk) {
        // Payouts remain confined to the synthetic bank. Rider cash remittances
        // use the existing rider control account; each receipt is tied to a demo order.
        for (let n = 0; n < riders.length; n++) {
          const due = -(await accountBalance(
            current,
            "RIDERS_PAYABLE",
            riders[n].partyId,
          ));
          if (due > 0n && n % 3 !== 0)
            await deliveryAction(current, actor, {
              action: "SETTLE",
              requestId: id("rider-payout", n),
              riderId: riders[n].id,
              amount: decimal(n % 3 === 1 ? due / 2n : due),
              accountId: accounts.DEMO_BANK,
              note: P + "Training commission payout",
            });
        }
        for (let n = 0; n < riders.length; n++)
          if (n % 3 === 1) {
            const held = await riderCash(current, riders[n].id);
            if (held > 0n)
              await deliveryAction(current, actor, {
                action: "REMIT",
                requestId: id("rider-remit", n),
                riderId: riders[n].id,
                amount: decimal(held / 2n),
                accountId: accounts.DEMO_BANK,
                note: P + "Rider cash collected into training bank",
              });
          }
        // Cancel a few delivered samples to exercise immutable commission reversals.
        const reversals = await current.order.findMany({
          where: {
            id: { startsWith: "cafe-demo-v2-order-" },
            status: "DELIVERED",
            riderId: { not: null },
          },
          take: 6,
          orderBy: { id: "asc" },
        });
        for (const sample of reversals) {
          await current.order.update({
            where: { id: sample.id },
            data: {
              status: "CANCELLED",
              cancelReason: P + "Commission reversal example",
            },
          });
          await voidBusinessOrder(
            current,
            actor,
            sample,
            P + "Commission reversal example",
          );
          await reverseDelivery(
            current,
            actor,
            sample.id,
            P + "Commission reversal example",
          );
          served--;
          cancelled++;
        }
      }
      // Demo loans/customer collections and owner movements use only demo money accounts.
      await payParty(current, actor, {
        requestId: id("repayment", 1),
        kind: "STAFF_REPAYMENT",
        partyId: employees[5].partyId,
        amount: "250",
        accountId: accounts.DEMO_BANK,
        date: today,
        note: P + "Advance repaid by employee",
      });
      await moneyAction(current, actor, {
        requestId: id("transfer", 1),
        kind: "TRANSFER",
        amount: "5000",
        accountId: accounts.DEMO_CASH,
        toAccountId: accounts.DEMO_BANK,
        date: today,
        note: P + "Cash deposited into training bank",
      });
      if (bulk) await seedDemoExtras(current, actor);
      const ids = protectedProducts.map((p) => p.id);
      assert.equal(
        digest(
          await raw.product.findMany({
            where: { id: { in: ids } },
            orderBy: { id: "asc" },
            select: {
              id: true,
              name: true,
              price: true,
              image: true,
              stock: true,
              soldCount: true,
              isAvailable: true,
              categoryId: true,
            },
          }),
        ),
        digest(protectedProducts),
        "Existing menu records changed",
      );
      const orderIds = protectedOrders.map((o) => o.id);
      assert.equal(
        digest(
          await raw.order.findMany({
            where: { id: { in: orderIds } },
            orderBy: { id: "asc" },
            select: {
              id: true,
              status: true,
              total: true,
              amountPaid: true,
              amountRefunded: true,
              updatedAt: true,
            },
          }),
        ),
        digest(protectedOrders),
        "Existing orders changed",
      );
      assert.equal(
        digest(
          await raw.user.findMany({
            where: { id: { in: realUsers.map((u) => u.id) } },
            orderBy: { id: "asc" },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
              passwordHash: true,
            },
          }),
        ),
        digest(realUsers),
        "Existing user accounts changed",
      );
      for (const a of realMoney) {
        const account = await raw.businessAccount.findUniqueOrThrow({
          where: { id: a.id },
        });
        const sampleControl = bulk && account.code === "RIDER_CASH";
        const movement = sampleControl
          ? await raw.businessPosting.aggregate({
              where: { accountId: a.id, journal: { actorId: actor.id } },
              _sum: { debit: true, credit: true },
            })
          : null;
        const expected =
          moneyBefore.get(a.id)! +
          (movement
            ? paise(movement._sum.debit ?? 0) - paise(movement._sum.credit ?? 0)
            : 0n);
        assert.equal(
          await accountBalance(raw, a.id),
          expected,
          "Existing cash/bank account changed outside attributed demo rider cash",
        );
      }
      const afterConfig = await raw.businessConfig.findUniqueOrThrow({
        where: { id: 1 },
      });
      assert.equal(
        afterConfig.enabled,
        config.enabled,
        "Integration setting changed",
      );
      assert.equal(
        String(afterConfig.lockedThrough),
        String(config.lockedThrough),
        "Closed period changed",
      );
      const stockAfter =
        (await raw.ingredient.aggregate({ _sum: { stockValue: true } }))._sum
          .stockValue ?? 0;
      assert.equal(
        (await accountBalance(raw, "INVENTORY")) - inventoryBefore,
        paise(stockAfter) - paise(stockBefore),
        "Demo inventory does not reconcile",
      );
      const open = await raw.stockMovement.findMany({
        where: {
          order: {
            id: { startsWith: id("order", "") },
            status: { notIn: ["DELIVERED", "CANCELLED"] },
          },
          kind: "PREPARATION",
        },
      });
      const openCost = open.reduce((s, m) => s - paise(m.value), 0n);
      assert.equal(
        (await accountBalance(raw, "WIP")) - wipBefore,
        openCost,
        "Open food cost does not reconcile",
      );
      const sums = await raw.businessPosting.aggregate({
        _sum: { debit: true, credit: true },
      });
      assert.equal(
        paise(sums._sum.debit ?? 0),
        paise(sums._sum.credit ?? 0),
        "Unbalanced demo ledger",
      );
      const result = {
        demo: true,
        version: bulk ? 2 : 1,
        from: start,
        to: today,
        orders,
        served,
        cancelled,
        open: orders - served - cancelled,
        staff: employees.length,
        attendance: attendance.length,
        ingredients: ingredients.size,
        products: products.length,
        suppliers: suppliers.length,
        customers: customers.length,
        tables: tables.length,
        purchases,
        returns,
        expenses,
        payrolls,
        riders: riders.length,
        latestDemoOrder: prefix + (999 + orders),
        integrationActive: config.enabled,
        publicDemoMenu: false,
        warning:
          "Synthetic financial entries are included in reports. Use the owner Demo Data preview and verified-backup reset to remove registered synthetic entries. Original menu, users, orders and physical cash accounts were preserved.",
      };
      await audit(raw, actor, "IMPORT_DEMO_DATA", "DemoDataset", KEY, result);
      await raw.businessRequest.create({
        data: { key: KEY, payloadHash: digest({ version: 1 }), result },
      });
      console.log(
        "PASS: demo ledger balanced; original records and settings preserved.",
      );
      console.log(JSON.stringify(result, null, 2));
      await options?.complete?.(raw, result);
      return result;
    },
    { timeout: 1800000, maxWait: 10000 },
  );
}

/** Shared assumptions for operational practice; never presented as real recipes. */
export { recipe as assumedRecipe };

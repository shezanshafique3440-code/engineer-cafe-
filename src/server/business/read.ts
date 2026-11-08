import "server-only";
import { deliveryRead } from "./delivery";
import type { SessionUser } from "@/lib/types";
import { canBusiness } from "@/lib/business-access";
import {
  businessToday,
  dateValue,
  paise,
  quantity,
  decimal,
  divideRound,
} from "@/lib/business-math";
import { badRequest } from "@/server/api";
import { serializeOrder } from "@/server/orders";
import { accountBalance, type DB } from "./core";
import { stockReadiness } from "./inventory";
import { operationsRead } from "./operations-read";
import { reviewer } from "./operations";
export async function businessRead(
  tx: DB,
  actor: SessionUser,
  module: string,
  url: URL,
) {
  const from =
      url.searchParams.get("from") ?? businessToday().slice(0, 7) + "-01",
    to = url.searchParams.get("to") ?? businessToday();
  let start: Date, end: Date;
  try {
    start = dateValue(from);
    end = dateValue(to);
  } catch {
    throw badRequest("Choose real calendar dates.");
  }
  if (start > end || (end.getTime() - start.getTime()) / 86400000 > 732)
    throw badRequest("Choose a valid range of up to two years.");
  const filter = { gte: start, lte: end };
  const accounts = await tx.businessAccount.findMany({
    where: { isMoney: true, isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      drawer: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });
  const currentConfig = await tx.businessConfig.findUniqueOrThrow({
    where: { id: 1 },
  });
  const meta = {
    integrationActive: currentConfig.enabled,
    activatedAt: currentConfig.enabledAt,
    accounts,
    today: businessToday(),
    from,
    to,
    owner: actor.role === "ADMIN",
  };
  switch (module) {
    case "delivery":
      return { ...meta, ...(await deliveryRead(tx, start, end)) };
    case "procurement":
    case "stockcounts":
    case "approvals":
      return { ...meta, ...(await operationsRead(tx, actor, module)) };
    case "overview":
    case "ledger": {
      const [allAccounts, period, balances, parties, sales, config] =
        await Promise.all([
          tx.businessAccount.findMany({ orderBy: { code: "asc" } }),
          tx.businessPosting.groupBy({
            by: ["accountId"],
            where: { journal: { date: filter } },
            _sum: { debit: true, credit: true },
          }),
          tx.businessPosting.groupBy({
            by: ["accountId"],
            where: { journal: { date: { lte: end } } },
            _sum: { debit: true, credit: true },
          }),
          tx.businessPosting.groupBy({
            by: ["partyId", "accountId"],
            where: { partyId: { not: null }, journal: { date: { lte: end } } },
            _sum: { debit: true, credit: true },
          }),
          tx.businessSaleLine.groupBy({
            by: ["productName"],
            where: { date: filter },
            _sum: { quantity: true, gross: true, net: true, cost: true },
          }),
          tx.businessConfig.findUniqueOrThrow({ where: { id: 1 } }),
        ]);
      const amounts = new Map(
        period.map((a) => [
          a.accountId,
          paise(a._sum.debit ?? 0) - paise(a._sum.credit ?? 0),
        ]),
      );
      let income = 0n,
        expenses = 0n,
        cogs = 0n;
      for (const a of allAccounts) {
        const value = amounts.get(a.id) ?? 0n;
        if (a.kind === "INCOME") income -= value;
        if (a.kind === "EXPENSE") expenses += value;
        if (a.code === "COGS") cogs = value;
      }
      const balanceRows = allAccounts.map((a) => {
        const b = balances.find((b) => b.accountId === a.id);
        return {
          ...a,
          balance: decimal(
            paise(b?._sum.debit ?? 0) - paise(b?._sum.credit ?? 0),
          ),
          period: decimal(amounts.get(a.id) ?? 0n),
        };
      });
      const trialDebit = balanceRows.reduce(
          (s, a) => s + (paise(a.balance) > 0n ? paise(a.balance) : 0n),
          0n,
        ),
        trialCredit = balanceRows.reduce(
          (s, a) => s + (paise(a.balance) < 0n ? -paise(a.balance) : 0n),
          0n,
        );
      const summaries = new Map<
        string,
        {
          productName: string;
          quantity: number;
          sales: bigint;
          cost: bigint;
          gross: bigint;
        }
      >();
      for (const s of sales) {
        const row = summaries.get(s.productName) ?? {
          productName: s.productName,
          quantity: 0,
          sales: 0n,
          cost: 0n,
          gross: 0n,
        };
        row.quantity += s._sum.quantity ?? 0;
        row.sales += paise(s._sum.net ?? 0);
        row.cost += paise(s._sum.cost ?? 0);
        row.gross += paise(s._sum.gross ?? 0);
        summaries.set(s.productName, row);
      }
      const itemRows = [...summaries.values()].map((s) => ({
        ...s,
        sales: decimal(s.sales),
        cost: decimal(s.cost),
        gross: decimal(s.gross),
        profit: decimal(s.sales - s.cost),
        margin: s.sales
          ? decimal(divideRound((s.sales - s.cost) * 10000n, s.sales))
          : null,
        markup:
          s.cost > 0n
            ? decimal(divideRound((s.sales - s.cost) * 10000n, s.cost))
            : null,
      }));
      const partyRecords = await tx.businessParty.findMany({
        where: { id: { in: parties.map((p) => p.partyId!) } },
      });
      const partyBalances = parties.map((p) => ({
        party: partyRecords.find((x) => x.id === p.partyId),
        account: allAccounts.find((a) => a.id === p.accountId)?.name,
        code: allAccounts.find((a) => a.id === p.accountId)?.code,
        balance: decimal(paise(p._sum.debit ?? 0) - paise(p._sum.credit ?? 0)),
      }));
      const journals =
        module === "ledger"
          ? await tx.businessJournal.findMany({
              where: { date: filter },
              include: {
                postings: {
                  include: { account: true, party: { select: { name: true } } },
                },
                reversedBy: { select: { id: true } },
              },
              orderBy: [{ date: "desc" }, { createdAt: "desc" }],
              take: 200,
            })
          : [];
      const cashFlow = await tx.$queryRaw<
        {
          source: string;
          received: { toString(): string };
          paid: { toString(): string };
        }[]
      >`
        SELECT j.source, SUM(p.debit) AS received, SUM(p.credit) AS paid
        FROM "BusinessPosting" p JOIN "BusinessJournal" j ON j.id=p."journalId"
        JOIN "BusinessAccount" a ON a.id=p."accountId"
        WHERE a."isMoney"=true AND j.date >= ${start} AND j.date <= ${end}
        GROUP BY j.source ORDER BY j.source`;
      const openingMoney = await tx.businessPosting.aggregate({
        where: { account: { isMoney: true }, journal: { date: { lt: start } } },
        _sum: { debit: true, credit: true },
      });
      const dailySales = await tx.businessSaleLine.groupBy({
        by: ["date"],
        where: { date: filter },
        _sum: { quantity: true, net: true, cost: true },
        orderBy: { date: "asc" },
      });
      const openingCash =
        paise(openingMoney._sum.debit ?? 0) -
        paise(openingMoney._sum.credit ?? 0);
      const netCash = cashFlow.reduce(
        (sum, r) => sum + paise(r.received) - paise(r.paid),
        0n,
      );
      return {
        ...meta,
        cashFlow,
        openingMoney: decimal(openingCash),
        closingMoney: decimal(openingCash + netCash),
        netCashFlow: decimal(netCash),
        dailySales: dailySales.map((r) => ({
          date: r.date,
          quantity: r._sum.quantity,
          sales: String(r._sum.net ?? 0),
          cost: String(r._sum.cost ?? 0),
          profit: decimal(paise(r._sum.net ?? 0) - paise(r._sum.cost ?? 0)),
        })),
        config,
        revenue: decimal(income),
        cogs: decimal(cogs),
        grossProfit: decimal(income - cogs),
        expenses: decimal(expenses - cogs),
        netProfit: decimal(income - expenses),
        margin: income
          ? decimal(divideRound((income - expenses) * 10000n, income))
          : null,
        balances: balanceRows,
        trialDebit: decimal(trialDebit),
        trialCredit: decimal(trialCredit),
        partyBalances: module === "ledger" ? partyBalances : [],
        sales: itemRows,
        salesCapped: false,
        journals,
        legacyOrders: await tx.order.count({
          where: {
            businessTracked: false,
            createdAt: { gte: start, lte: new Date(end.getTime() + 86400000) },
          },
        }),
      };
    }
    case "ingredients": {
      const ingredients = await tx.ingredient.findMany({
        orderBy: { name: "asc" },
        take: 500,
      });
      const reserved = await tx.ingredientReservation.groupBy({
        by: ["ingredientId"],
        where: { consumedAt: null, releasedAt: null },
        _sum: { quantity: true },
      });
      const id = url.searchParams.get("ingredientId");
      const movements = await tx.stockMovement.findMany({
        where: id ? { ingredientId: id } : {},
        include: { ingredient: { select: { name: true, unit: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const edit = canBusiness(actor, "inventory");
      return {
        ...meta,
        ingredients: ingredients.map((i) => ({
          ...i,
          ...(!edit ? { stockValue: undefined } : {}),
          reserved: decimal(
            quantity(
              reserved.find((r) => r.ingredientId === i.id)?._sum.quantity ?? 0,
            ),
            4,
          ),
          available: decimal(
            quantity(i.quantity) -
              quantity(
                reserved.find((r) => r.ingredientId === i.id)?._sum.quantity ??
                  0,
              ),
            4,
          ),
          low:
            quantity(i.quantity) -
              quantity(
                reserved.find((r) => r.ingredientId === i.id)?._sum.quantity ??
                  0,
              ) <=
            quantity(i.reorderAt),
          version: i.updatedAt.toISOString(),
        })),
        movements: movements.map((m) =>
          edit ? m : { ...m, value: undefined, balanceValue: undefined },
        ),
        canEdit: edit,
      };
    }
    case "recipes": {
      const [ingredients, products, addons, readiness] = await Promise.all([
        tx.ingredient.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
        }),
        tx.product.findMany({
          select: {
            id: true,
            name: true,
            price: true,
            discountPrice: true,
            recipeRequired: true,
            recipe: { include: { lines: true } },
          },
          orderBy: { name: "asc" },
          take: 500,
        }),
        tx.productAddon.findMany({
          include: { recipe: { include: { lines: true } } },
          orderBy: { name: "asc" },
          take: 500,
        }),
        stockReadiness(tx),
      ]);
      const estimate = (
        recipe: {
          yieldUnits: { toString(): string };
          lines: { ingredientId: string; quantity: { toString(): string } }[];
        } | null,
      ) => {
        if (!recipe) return null;
        let total = 0n;
        for (const l of recipe.lines) {
          const ingredient = ingredients.find((i) => i.id === l.ingredientId);
          if (!ingredient || quantity(ingredient.quantity) === 0n) return null;
          total += divideRound(
            paise(ingredient.stockValue) * quantity(l.quantity) * 10000n,
            quantity(ingredient.quantity) * quantity(recipe.yieldUnits),
          );
        }
        return decimal(total);
      };
      return {
        ...meta,
        ingredients,
        products: products.map((p) => ({
          ...p,
          estimatedCost: estimate(p.recipe),
          sellingPrice:
            p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price
              ? p.discountPrice
              : p.price,
        })),
        addons,
        readiness,
      };
    }
    case "suppliers":
    case "customers":
    case "receivables": {
      const kind = module === "suppliers" ? "SUPPLIER" : "CUSTOMER";
      const parties = await tx.businessParty.findMany({
        where: { kind },
        orderBy: { name: "asc" },
        take: 500,
      });
      const rows = [];
      for (const party of parties) {
        const balance = await accountBalance(
          tx,
          kind === "SUPPLIER" ? "SUPPLIER_CONTROL" : "CUSTOMER_CONTROL",
          party.id,
        );
        rows.push({
          ...party,
          balance: decimal(kind === "SUPPLIER" ? -balance : balance),
          version: party.updatedAt.toISOString(),
        });
      }
      const orders =
        module === "receivables"
          ? await tx.order.findMany({
              where: {
                businessTracked: true,
                businessCredit: true,
                status: "DELIVERED",
              },
              select: {
                id: true,
                orderNumber: true,
                total: true,
                amountPaid: true,
                amountRefunded: true,
                businessPartyId: true,
              },
              orderBy: { createdAt: "asc" },
              take: 500,
            })
          : [];
      return { ...meta, parties: rows, orders };
    }
    case "purchases": {
      const [purchases, suppliers, ingredients] = await Promise.all([
        tx.businessPurchase.findMany({
          where: { date: filter },
          include: {
            supplier: { select: { name: true } },
            lines: {
              include: { ingredient: { select: { name: true, unit: true } } },
            },
            payments: {
              include: {
                journal: { select: { reversedBy: { select: { id: true } } } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 150,
        }),
        tx.businessParty.findMany({
          where: { kind: "SUPPLIER", isActive: true },
          orderBy: { name: "asc" },
        }),
        tx.ingredient.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
        }),
      ]);
      return { ...meta, purchases, suppliers, ingredients };
    }
    case "staff": {
      const employees = await tx.employee.findMany({
        include: {
          party: true,
          access: {
            include: {
              user: { select: { id: true, email: true, isActive: true } },
            },
          },
        },
        orderBy: { code: "asc" },
        take: 500,
      });
      const rows = [];
      for (const e of employees)
        rows.push({
          ...e,
          advance: decimal(
            await accountBalance(tx, "STAFF_ADVANCES", e.partyId),
          ),
          salaryDue: decimal(
            -(await accountBalance(tx, "SALARIES_PAYABLE", e.partyId)),
          ),
          version: e.updatedAt.toISOString(),
        });
      return { ...meta, employees: rows };
    }
    case "attendance": {
      const [employees, attendance, todayAttendance] = await Promise.all([
        tx.employee.findMany({
          where: { isActive: true },
          select: { id: true, code: true, party: { select: { name: true } } },
          orderBy: { code: "asc" },
        }),
        tx.attendance.findMany({
          where: { date: filter },
          include: {
            employee: {
              select: { code: true, party: { select: { name: true } } },
            },
          },
          orderBy: [{ date: "desc" }, { employeeId: "asc" }],
          take: 1000,
        }),
        tx.attendance.findMany({
          where: { date: dateValue(businessToday()) },
          include: {
            employee: {
              select: { code: true, party: { select: { name: true } } },
            },
          },
          orderBy: { employeeId: "asc" },
        }),
      ]);
      return {
        ...meta,
        employees,
        todayAttendance: todayAttendance.map((a) => ({
          ...a,
          version: a.updatedAt.toISOString(),
        })),
        attendance: attendance.map((a) => ({
          ...a,
          version: a.updatedAt.toISOString(),
        })),
      };
    }
    case "payroll": {
      const [payroll, employees] = await Promise.all([
        tx.payrollRecord.findMany({
          include: {
            employee: { include: { party: true } },
            payments: {
              include: {
                journal: { select: { reversedBy: { select: { id: true } } } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
        tx.employee.findMany({
          include: { party: true },
          orderBy: { code: "asc" },
        }),
      ]);
      return {
        ...meta,
        employees,
        payroll: payroll.map((p) => ({
          ...p,
          version: p.updatedAt.toISOString(),
          paid: decimal(
            p.payments
              .filter((p) => !p.journal.reversedBy)
              .reduce((s, p) => s + paise(p.amount), 0n),
          ),
        })),
      };
    }
    case "cash": {
      const drawers = await tx.cashDrawer.findMany({
        include: { account: true },
        where: { isActive: true },
        orderBy: { name: "asc" },
      });
      const rows = [];
      for (const d of drawers)
        rows.push({
          ...d,
          balance: decimal(await accountBalance(tx, d.accountId)),
          activeShift: await tx.cashShift.findFirst({
            where: { drawerId: d.id, closedAt: null },
          }),
        });
      const shifts = await tx.cashShift.findMany({
        where:
          actor.role === "ADMIN" || canBusiness(actor, "attendance")
            ? {}
            : { openedById: actor.id },
        include: { drawer: { select: { name: true } } },
        orderBy: { openedAt: "desc" },
        take: 100,
      });
      return { ...meta, drawers: rows, shifts, canReview: reviewer(actor) };
    }
    case "money": {
      const journals = await tx.businessJournal.findMany({
        where: {
          date: filter,
          OR: [
            {
              source: {
                in: [
                  "EXPENSE",
                  "CAPITAL",
                  "DRAW",
                  "TRANSFER",
                  "CORRECTION",
                  "CORRECTION_IN",
                ],
              },
            },
            {
              source: "OPENING",
              postings: { some: { account: { isMoney: true } } },
            },
            {
              source: "REVERSAL",
              reversalOf: {
                source: {
                  in: [
                    "EXPENSE",
                    "CAPITAL",
                    "DRAW",
                    "TRANSFER",
                    "CORRECTION",
                    "CORRECTION_IN",
                  ],
                },
              },
            },
            {
              source: "REVERSAL",
              reversalOf: {
                source: "OPENING",
                postings: { some: { account: { isMoney: true } } },
              },
            },
          ],
        },
        include: {
          postings: { include: { account: true } },
          reversedBy: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 150,
      });
      return { ...meta, journals };
    }
    case "tables": {
      const tables = await tx.cafeTable.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: { select: { sessions: { where: { closedAt: null } } } },
          sessions: {
            where: {
              closedAt: null,
              ...(actor.businessProfile === "WAITER"
                ? { waiterId: actor.employeeId ?? "unassigned" }
                : {}),
            },
            include: {
              waiter: {
                select: {
                  id: true,
                  code: true,
                  party: { select: { name: true } },
                },
              },
              orders: {
                include: {
                  items: { include: { addons: true } },
                  events: { orderBy: { createdAt: "asc" } },
                },
              },
            },
          },
        },
      });
      const waiters = await tx.employee.findMany({
        where: { isActive: true },
        select: { id: true, code: true, party: { select: { name: true } } },
        orderBy: { code: "asc" },
      });
      return {
        ...meta,
        tables: tables.map((t) => ({
          ...t,
          busy: t._count.sessions > 0,
          sessions: t.sessions.map((s) => ({
            ...s,
            orders: s.orders.map(serializeOrder),
            total: s.orders
              .filter((o) => o.status !== "CANCELLED")
              .reduce((n, o) => n + o.total, 0),
            paid: decimal(
              s.orders
                .filter((o) => o.status !== "CANCELLED")
                .reduce(
                  (n, o) => n + paise(o.amountPaid) - paise(o.amountRefunded),
                  0n,
                ),
            ),
          })),
        })),
        waiters,
      };
    }
    case "setup":
      return {
        ...meta,
        config: await tx.businessConfig.findUniqueOrThrow({ where: { id: 1 } }),
        readiness: await stockReadiness(tx),
        users: await tx.user.findMany({
          where: { role: "STAFF" },
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            staffAccess: true,
          },
          orderBy: { name: "asc" },
          take: 500,
        }),
        employees: await tx.employee.findMany({
          include: { party: { select: { name: true } } },
          orderBy: { code: "asc" },
          take: 500,
        }),
        parties: await tx.businessParty.findMany({
          orderBy: { name: "asc" },
          take: 1000,
        }),
      };
    case "audit": {
      const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
      const rawPage = Number(url.searchParams.get("page") ?? 1);
      if (!Number.isInteger(rawPage) || rawPage < 1 || rawPage > 100000)
        throw badRequest("Invalid history page.");
      const where = {
        createdAt: {
          gte: new Date(start.getTime() - 5 * 3600000),
          lt: new Date(end.getTime() + 19 * 3600000),
        },
        ...(q
          ? {
              OR: ["actorName", "action", "entity", "entityId"].map(
                (field) => ({
                  [field]: { contains: q, mode: "insensitive" as const },
                }),
              ),
            }
          : {}),
      };
      return {
        ...meta,
        page: rawPage,
        total: await tx.businessAudit.count({ where }),
        rows: await tx.businessAudit.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (rawPage - 1) * 50,
          take: 50,
        }),
      };
    }
    default:
      throw badRequest("Unknown business module.");
  }
}

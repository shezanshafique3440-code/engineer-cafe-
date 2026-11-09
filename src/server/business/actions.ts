import "server-only";
import { deliveryAction } from "./delivery";
import { hashPassword } from "@/server/auth";
import type { SessionUser } from "@/lib/types";
import { badRequest, forbidden } from "@/server/api";
import { businessToday, dateValue, paise, quantity } from "@/lib/business-math";
import { canBusiness, profileCapabilities } from "@/lib/business-access";
import { audit, hash, type DB, versionCheck } from "./core";
import { schemas, type Module } from "./validation";
import { adjustIngredient, stockReadiness } from "./inventory";
import { payParty, postPurchase, returnPurchase } from "./purchases";
import { draftPayroll, postPayroll, reversePayroll } from "./payroll";
import { cashAction, moneyAction, openingParty, reverseMoney } from "./cash";
import { receiveOrderMoney } from "./order-ledger";
import {
  procurementAction,
  stockCountAction,
  approvalAction,
  reviewer,
} from "./operations";
export const MODULE_CAPS: Record<string, string> = {
  delivery: "delivery",
  overview: "reports",
  ingredients: "stock-read",
  recipes: "inventory",
  suppliers: "purchases",
  customers: "finance",
  purchases: "purchases",
  payments: "payments",
  staff: "payroll",
  attendance: "attendance",
  payroll: "payroll",
  cash: "cash",
  procurement: "purchases",
  stockcounts: "inventory",
  approvals: "payments",
  money: "expenses",
  ledger: "finance",
  opening: "setup",
  reversal: "finance",
  tables: "tables",
  setup: "setup",
  audit: "finance",
  receivables: "payments",
};
function checkDate(value: string) {
  const d = dateValue(value);
  if (d > dateValue(businessToday()))
    throw badRequest("Future records cannot be posted.");
  return d;
}
export async function businessAction(
  tx: DB,
  actor: SessionUser,
  module: Module,
  body: unknown,
) {
  switch (module) {
    case "delivery":
      return deliveryAction(tx, actor, schemas.delivery.parse(body));
    case "procurement":
      return procurementAction(tx, actor, schemas.procurement.parse(body));
    case "stockcounts":
      return stockCountAction(tx, actor, schemas.stockcounts.parse(body));
    case "approvals":
      return approvalAction(tx, actor, schemas.approvals.parse(body));
    case "ingredients": {
      if (!canBusiness(actor, "inventory")) throw forbidden();
      const d = schemas.ingredients.parse(body);
      if (d.action === "ADJUST") {
        if (
          d.kind === "OPENING" &&
          (await tx.businessConfig.findUniqueOrThrow({ where: { id: 1 } }))
            .enabled
        )
          throw badRequest(
            "Opening stock is closed after activation. Use a purchase or stock count.",
          );
        const ingredient = await tx.ingredient.findUniqueOrThrow({
          where: { id: d.ingredientId },
        });
        if (d.kind === "COUNT")
          await versionCheck(d.version, ingredient.updatedAt);
        checkDate(d.date);
        return adjustIngredient(tx, actor, d);
      }
      if (d.id) {
        const old = await tx.ingredient.findUniqueOrThrow({
          where: { id: d.id },
        });
        await versionCheck(d.version, old.updatedAt);
        if (
          d.unit !== old.unit &&
          (quantity(old.quantity) > 0n ||
            (await tx.stockMovement.count({ where: { ingredientId: old.id } })))
        )
          throw badRequest(
            "Unit cannot change after stock movements. Create a new ingredient.",
          );
        if (
          !d.isActive &&
          (await tx.ingredientReservation.count({
            where: { ingredientId: old.id, consumedAt: null, releasedAt: null },
          }))
        )
          throw badRequest(
            "Cancel or prepare reserved orders before archiving this ingredient.",
          );
        const result = await tx.ingredient.update({
          where: { id: old.id },
          data: {
            name: d.name,
            unit: d.unit,
            reorderAt: d.reorderAt,
            isActive: d.isActive,
          },
        });
        await audit(tx, actor, "EDIT_INGREDIENT", "Ingredient", old.id, {
          name: d.name,
          unit: d.unit,
          isActive: d.isActive,
        });
        return result;
      }
      const result = await tx.ingredient.create({
        data: {
          name: d.name,
          unit: d.unit,
          reorderAt: d.reorderAt,
          isActive: d.isActive,
        },
      });
      await audit(tx, actor, "CREATE_INGREDIENT", "Ingredient", result.id, {
        name: d.name,
        unit: d.unit,
      });
      return result;
    }
    case "recipes": {
      const d = schemas.recipes.parse(body);
      if (Boolean(d.productId) === Boolean(d.addonId))
        throw badRequest("Choose one product or one add-on.");
      if (new Set(d.lines.map((l) => l.ingredientId)).size !== d.lines.length)
        throw badRequest("Combine duplicate ingredients.");
      if (d.required && !d.lines.length)
        throw badRequest("A tracked recipe needs ingredients.");
      const where = d.productId
        ? { productId: d.productId }
        : { addonId: d.addonId! };
      const existing = await tx.recipe.findUnique({ where });
      if (existing) await versionCheck(d.version, existing.updatedAt);
      if (d.productId)
        await tx.product.update({
          where: { id: d.productId },
          data: { recipeRequired: d.required },
        });
      const active = await tx.ingredient.count({
        where: {
          id: { in: d.lines.map((l) => l.ingredientId) },
          isActive: true,
        },
      });
      if (active !== d.lines.length)
        throw badRequest("A selected ingredient is inactive or missing.");
      const result = existing
        ? await tx.recipe.update({
            where: { id: existing.id },
            data: {
              reviewRequired: false,
              yieldUnits: d.yieldUnits,
              note: d.note,
              lines: { deleteMany: {}, create: d.lines },
            },
          })
        : await tx.recipe.create({
            data: {
              ...where,
              reviewRequired: false,
              yieldUnits: d.yieldUnits,
              note: d.note,
              lines: { create: d.lines },
            },
          });
      await audit(tx, actor, "SAVE_RECIPE", "Recipe", result.id, {
        productId: d.productId ?? null,
        addonId: d.addonId ?? null,
        yield: d.yieldUnits,
        lines: d.lines,
        required: d.required,
      });
      return result;
    }
    case "suppliers":
    case "customers": {
      const d =
        module === "suppliers"
          ? schemas.suppliers.parse(body)
          : schemas.customers.parse(body);
      const kind = module === "suppliers" ? "SUPPLIER" : "CUSTOMER";
      if (kind === "CUSTOMER" && actor.role !== "ADMIN") throw forbidden();
      const payload = {
        kind,
        name: d.name,
        phone: d.phone || null,
        email: d.email || null,
        address: d.address || null,
        isActive: d.isActive,
        ...("creditLimit" in d && typeof d.creditLimit === "string"
          ? { creditLimit: d.creditLimit }
          : {}),
      };
      let result;
      if (d.id) {
        const old = await tx.businessParty.findUniqueOrThrow({
          where: { id: d.id },
        });
        if (old.kind !== kind) throw badRequest("Party type cannot change.");
        await versionCheck(d.version, old.updatedAt);
        result = await tx.businessParty.update({
          where: { id: old.id },
          data: payload,
        });
      } else result = await tx.businessParty.create({ data: payload });
      await audit(tx, actor, "SAVE_" + kind, "Party", result.id, {
        name: d.name,
        isActive: d.isActive,
      });
      return result;
    }
    case "purchases": {
      const d = schemas.purchases.parse(body);
      checkDate(d.date);
      return d.action === "POST"
        ? postPurchase(tx, actor, d)
        : returnPurchase(tx, actor, d);
    }
    case "staff": {
      const d = schemas.staff.parse(body);
      const joined = dateValue(d.joinedOn),
        left = d.leftOn ? dateValue(d.leftOn) : null;
      if (!d.isActive && !left)
        throw badRequest("Enter a leaving date when deactivating an employee.");
      if (left && left < joined)
        throw badRequest("Leaving date must follow joining date.");
      let employee;
      if (d.id) {
        const old = await tx.employee.findUniqueOrThrow({
          where: { id: d.id },
          include: { access: true },
        });
        await versionCheck(d.version, old.updatedAt);
        if (d.login)
          throw badRequest(
            "Use access setup to link an existing employee login.",
          );
        await tx.businessParty.update({
          where: { id: old.partyId },
          data: { name: d.name, phone: d.phone || null, isActive: d.isActive },
        });
        employee = await tx.employee.update({
          where: { id: old.id },
          data: {
            code: d.code,
            designation: d.designation,
            payBasis: d.payBasis,
            basePay: d.basePay,
            overtimeRate: d.overtimeRate,
            joinedOn: joined,
            leftOn: left,
            isActive: d.isActive,
            notes: d.notes,
          },
        });
        if (old.access && !d.isActive)
          await tx.user.update({
            where: { id: old.access.userId },
            data: { isActive: false },
          });
      } else {
        const party = await tx.businessParty.create({
          data: { kind: "EMPLOYEE", name: d.name, phone: d.phone || null },
        });
        employee = await tx.employee.create({
          data: {
            partyId: party.id,
            code: d.code,
            designation: d.designation,
            payBasis: d.payBasis,
            basePay: d.basePay,
            overtimeRate: d.overtimeRate,
            joinedOn: joined,
            leftOn: left,
            isActive: d.isActive,
            notes: d.notes,
          },
        });
        if (d.login) {
          const user = await tx.user.create({
            data: {
              name: d.name,
              email: d.login.email,
              passwordHash: await hashPassword(d.login.password),
              role: "STAFF",
              phone: d.phone || null,
              isActive: d.isActive,
            },
          });
          await tx.staffAccess.create({
            data: {
              userId: user.id,
              employeeId: employee.id,
              profile: d.login.profile,
            },
          });
        }
      }
      await audit(tx, actor, "SAVE_EMPLOYEE", "Employee", employee.id, {
        code: d.code,
        name: d.name,
        designation: d.designation,
        basePay: d.basePay,
        payBasis: d.payBasis,
        isActive: d.isActive,
      });
      return employee;
    }
    case "attendance": {
      const d = schemas.attendance.parse(body);
      const date = checkDate(d.date),
        employee = await tx.employee.findUniqueOrThrow({
          where: { id: d.employeeId },
        });
      if (
        date < employee.joinedOn ||
        (employee.leftOn && date > employee.leftOn)
      )
        throw badRequest("Attendance date is outside this employment period.");
      if (
        d.clockIn &&
        d.clockOut &&
        new Date(d.clockOut) <= new Date(d.clockIn)
      )
        throw badRequest("Clock-out must follow clock-in.");
      if (d.clockOut && !d.clockIn)
        throw badRequest("Record clock-in before clock-out.");
      if (d.clockIn && businessToday(new Date(d.clockIn)) !== d.date)
        throw badRequest("Clock-in must belong to this Pakistan work date.");
      if (
        (d.clockOut && new Date(d.clockOut).getTime() > Date.now() + 60000) ||
        (d.clockIn && new Date(d.clockIn).getTime() > Date.now() + 60000)
      )
        throw badRequest("Actual attendance times cannot be in the future.");
      if (
        ["ABSENT", "UNPAID_LEAVE"].includes(d.status) &&
        Number(d.overtimeHours) > 0
      )
        throw badRequest("Absence cannot include overtime.");
      const old = await tx.attendance.findUnique({
        where: { employeeId_date: { employeeId: d.employeeId, date } },
      });
      if (old) await versionCheck(d.version, old.updatedAt);
      const payload = {
        status: d.status,
        clockIn: d.clockIn ? new Date(d.clockIn) : null,
        clockOut: d.clockOut ? new Date(d.clockOut) : null,
        overtimeHours: d.overtimeHours,
        notes: d.notes,
        recordedBy: actor.name,
      };
      const result = old
        ? await tx.attendance.update({ where: { id: old.id }, data: payload })
        : await tx.attendance.create({
            data: { employeeId: d.employeeId, date, ...payload },
          });
      await audit(tx, actor, "RECORD_ATTENDANCE", "Attendance", result.id, {
        employeeId: d.employeeId,
        date: d.date,
        ...payload,
        clockIn: d.clockIn ?? null,
        clockOut: d.clockOut ?? null,
      });
      return result;
    }
    case "payroll": {
      const d = schemas.payroll.parse(body);
      return d.action === "DRAFT"
        ? draftPayroll(tx, actor, d)
        : d.action === "POST"
          ? postPayroll(tx, actor, d)
          : reversePayroll(tx, actor, d);
    }
    case "payments": {
      const d = schemas.payments.parse(body);
      if (
        [
          "PAYROLL_PAYMENT",
          "SALARY_BALANCE_PAYMENT",
          "STAFF_ADVANCE",
          "STAFF_REPAYMENT",
        ].includes(d.kind) &&
        !canBusiness(actor, "payroll")
      )
        throw forbidden();
      if (
        ["SUPPLIER_PAYMENT", "SUPPLIER_REFUND"].includes(d.kind) &&
        !canBusiness(actor, "purchases")
      )
        throw forbidden();
      checkDate(d.date);
      return payParty(tx, actor, d);
    }
    case "cash":
      return cashAction(tx, actor, schemas.cash.parse(body));
    case "money": {
      const d = schemas.money.parse(body);
      checkDate(d.date);
      return moneyAction(tx, actor, d);
    }
    case "opening": {
      const d = schemas.opening.parse(body);
      checkDate(d.date);
      if (
        (await tx.businessConfig.findUniqueOrThrow({ where: { id: 1 } }))
          .enabled
      )
        throw badRequest(
          "Opening balances are closed after activation. Record a current transaction instead.",
        );
      return openingParty(tx, actor, d);
    }
    case "reversal":
      return reverseMoney(tx, actor, schemas.reversal.parse(body));
    case "tables": {
      const d = schemas.tables.parse(body);
      if (d.action === "SAVE") {
        if (!canBusiness(actor, "catalog")) throw forbidden();
        if (
          d.id &&
          !d.isActive &&
          (await tx.tableSession.count({
            where: { tableId: d.id, closedAt: null },
          }))
        )
          throw badRequest(
            "Close the active table bill before deactivating this table.",
          );
        const table = d.id
          ? await tx.cafeTable.update({
              where: { id: d.id },
              data: { name: d.name, seats: d.seats, isActive: d.isActive },
            })
          : await tx.cafeTable.create({
              data: { name: d.name, seats: d.seats, isActive: d.isActive },
            });
        await audit(tx, actor, "SAVE_TABLE", "Table", table.id, {
          name: d.name,
          seats: d.seats,
          isActive: d.isActive,
        });
        return table;
      }
      if (d.action === "OPEN") {
        if (
          !(await tx.businessConfig.findUniqueOrThrow({ where: { id: 1 } }))
            .enabled
        )
          throw badRequest("Activate accounting before opening table bills.");
        const table = await tx.cafeTable.findUniqueOrThrow({
          where: { id: d.tableId },
        });
        if (!table.isActive) throw badRequest("Table is inactive.");
        if (
          await tx.tableSession.findFirst({
            where: { tableId: table.id, closedAt: null },
          })
        )
          throw badRequest("This table already has an open bill.");
        const waiterId =
          actor.businessProfile === "WAITER" ? actor.employeeId : d.waiterId;
        if (
          waiterId &&
          !(await tx.employee.findFirst({
            where: { id: waiterId, isActive: true },
          }))
        )
          throw badRequest("Waiter is unavailable.");
        const session = await tx.tableSession.create({
          data: {
            tableId: table.id,
            waiterId: waiterId ?? null,
            openedById: actor.id,
            guestCount: d.guestCount,
          },
        });
        await audit(tx, actor, "OPEN_TABLE", "TableSession", session.id, {
          table: table.name,
          guestCount: d.guestCount,
        });
        return session;
      }
      const session = await tx.tableSession.findUniqueOrThrow({
        where: { id: d.sessionId },
        include: { orders: { orderBy: { createdAt: "asc" } } },
      });
      if (session.closedAt) throw badRequest("Table bill is already closed.");
      if (["TRANSFER", "MERGE", "SPLIT"].includes(d.action)) {
        if (!reviewer(actor) && !canBusiness(actor, "payments"))
          throw forbidden("A cashier, manager or owner must move bills.");
        if (d.action === "TRANSFER") {
          const target = await tx.cafeTable.findUniqueOrThrow({
            where: { id: d.tableId },
          });
          if (
            !target.isActive ||
            (await tx.tableSession.count({
              where: { tableId: target.id, closedAt: null },
            }))
          )
            throw badRequest("Choose a different available table.");
          const moved = await tx.tableSession.update({
            where: { id: session.id },
            data: { tableId: target.id },
          });
          await tx.order.updateMany({
            where: { tableSessionId: session.id },
            data: { tableName: target.name },
          });
          await audit(tx, actor, "TRANSFER_TABLE", "TableSession", session.id, {
            from: session.tableId,
            to: target.id,
            note: d.note,
          });
          return moved;
        }
        if (d.action === "MERGE" || d.action === "SPLIT") {
          const target = await tx.tableSession.findUniqueOrThrow({
            where: { id: d.targetSessionId },
            include: { table: true },
          });
          if (
            target.id === session.id ||
            target.closedAt ||
            !target.table.isActive
          )
            throw badRequest("Choose a different open table bill.");
          const ids =
            d.action === "MERGE"
              ? session.orders.map((o) => o.id)
              : (d.orderIds ?? []);
          if (
            !ids.length ||
            new Set(ids).size !== ids.length ||
            ids.some((id) => !session.orders.some((o) => o.id === id))
          )
            throw badRequest("Select tickets from the source bill.");
          if (d.action === "SPLIT" && ids.length === session.orders.length)
            throw badRequest("Use merge to move every ticket.");
          await tx.order.updateMany({
            where: { id: { in: ids }, tableSessionId: session.id },
            data: { tableSessionId: target.id, tableName: target.table.name },
          });
          if (d.action === "MERGE") {
            await tx.tableSession.update({
              where: { id: session.id },
              data: { closedAt: new Date() },
            });
            await tx.tableSession.update({
              where: { id: target.id },
              data: { guestCount: { increment: session.guestCount } },
            });
          }
          await audit(
            tx,
            actor,
            d.action + "_TABLE",
            "TableSession",
            session.id,
            { targetSessionId: target.id, orderIds: ids, note: d.note },
          );
          return { targetSessionId: target.id, moved: ids.length };
        }
      }
      if (d.action === "PAY") {
        if (!canBusiness(actor, "payments")) throw forbidden();
        let remaining = paise(d.amount);
        const due = session.orders
          .filter((o) => o.status !== "CANCELLED")
          .reduce(
            (s, o) =>
              s +
              BigInt(o.total) * 100n -
              paise(o.amountPaid) +
              paise(o.amountRefunded),
            0n,
          );
        if (remaining <= 0n || remaining > due)
          throw badRequest("Payment exceeds the table balance.");
        for (const o of session.orders) {
          if (o.status === "CANCELLED") continue;
          const bill =
              BigInt(o.total) * 100n -
              paise(o.amountPaid) +
              paise(o.amountRefunded),
            pay = remaining > bill ? bill : remaining;
          if (pay > 0n) {
            await receiveOrderMoney(tx, actor, {
              orderId: o.id,
              amount: pay,
              accountId: d.accountId,
              requestId: `${d.requestId}:${o.id}`,
              note: d.note,
            });
            remaining -= pay;
          }
          if (!remaining) break;
        }
        return { paid: d.amount, sessionId: session.id };
      }
      if (!canBusiness(actor, "payments")) throw forbidden();
      if (
        session.orders.some(
          (o) =>
            !["DELIVERED", "CANCELLED"].includes(o.status) ||
            (o.status === "CANCELLED" &&
              paise(o.amountPaid) > paise(o.amountRefunded)) ||
            (o.status !== "CANCELLED" &&
              BigInt(o.total) * 100n >
                paise(o.amountPaid) - paise(o.amountRefunded)),
        )
      )
        throw badRequest(
          "Serve/cancel all tickets and settle all payments/refunds before closing.",
        );
      const closed = await tx.tableSession.update({
        where: { id: session.id },
        data: { closedAt: new Date() },
      });
      await audit(tx, actor, "CLOSE_TABLE", "TableSession", session.id, {
        orders: session.orders.length,
      });
      return closed;
    }
    case "setup": {
      const d = schemas.setup.parse(body);
      if (actor.role !== "ADMIN") throw forbidden();
      if (d.action === "CONFIG") {
        const config = await tx.businessConfig.findUniqueOrThrow({
          where: { id: 1 },
        });
        if (d.enabled && !config.enabled) {
          const readiness = await stockReadiness(tx);
          if (
            await tx.order.count({
              where: {
                businessTracked: false,
                status: { notIn: ["DELIVERED", "CANCELLED"] },
              },
            })
          )
            throw badRequest(
              "Finish or cancel legacy open orders before activating accounting.",
            );
          if (!readiness.ready)
            throw badRequest(
              "Finish ingredient setup and recipes for all available tracked products before activation.",
            );
        }
        if (
          d.enabled === false &&
          config.enabled &&
          (
            await tx.$queryRaw<
              { n: number }[]
            >`SELECT COUNT(*)::int AS n FROM "Order" WHERE "businessTracked"=true AND (status NOT IN ('DELIVERED','CANCELLED') OR (status='DELIVERED' AND "amountPaid"-"amountRefunded"<total) OR (status='CANCELLED' AND "amountPaid">"amountRefunded"))`
          )[0].n
        )
          throw badRequest(
            "Settle all tracked open tickets before pausing automatic integration.",
          );
        if (d.lockedThrough) {
          checkDate(d.lockedThrough);
          if (
            config.lockedThrough &&
            dateValue(d.lockedThrough) < config.lockedThrough
          )
            throw badRequest("A closed accounting date cannot move backwards.");
        } else if (d.lockedThrough === null && config.lockedThrough)
          throw badRequest(
            "Posted accounting periods cannot be silently reopened.",
          );
        const result = await tx.businessConfig.update({
          where: { id: 1 },
          data: {
            ...(d.enabled === undefined
              ? {}
              : {
                  enabled: d.enabled,
                  ...(d.enabled && !config.enabled
                    ? { enabledAt: new Date() }
                    : {}),
                }),
            ...(d.lockedThrough === undefined
              ? {}
              : {
                  lockedThrough: d.lockedThrough
                    ? dateValue(d.lockedThrough)
                    : null,
                }),
          },
        });
        await audit(tx, actor, "CONFIGURE_BUSINESS", "Config", "1", {
          enabled: result.enabled,
          lockedThrough: d.lockedThrough ?? null,
          reason: d.note,
        });
        return result;
      }
      if (d.action === "ACCESS") {
        const target = await tx.user.findUniqueOrThrow({
          where: { id: d.userId },
        });
        if (target.role !== "STAFF")
          throw badRequest(
            "Choose a Staff login. Admin accounts already have owner access.",
          );
        if (
          d.employeeId &&
          !(await tx.employee.findFirst({
            where: { id: d.employeeId, isActive: true },
          }))
        )
          throw badRequest("Choose an active employee.");
        const permissions = [...new Set(d.permissions)];
        if (
          permissions.some(
            (cap) => !profileCapabilities(d.profile).includes(cap),
          )
        )
          throw badRequest(
            "Individual permissions must belong to the selected profile. Owner-only access cannot be granted to staff.",
          );
        const result = await tx.staffAccess.upsert({
          where: { userId: target.id },
          create: {
            userId: target.id,
            profile: d.profile,
            employeeId: d.employeeId,
            customPermissions: d.customPermissions,
            permissions,
          },
          update: {
            profile: d.profile,
            employeeId: d.employeeId,
            customPermissions: d.customPermissions,
            permissions,
          },
        });
        await audit(tx, actor, "GRANT_ACCESS", "User", target.id, {
          customPermissions: d.customPermissions,
          permissions,
          profile: d.profile,
          employeeId: d.employeeId ?? null,
        });
        return result;
      }
      const code = "MONEY_" + hash(d.requestId).slice(0, 12).toUpperCase();
      const account = await tx.businessAccount.create({
        data: { code, name: d.name, kind: "ASSET", isMoney: true },
      });
      if (d.kind === "CASH")
        await tx.cashDrawer.create({
          data: { name: d.name, accountId: account.id },
        });
      await audit(tx, actor, "CREATE_MONEY_ACCOUNT", "Account", account.id, {
        name: d.name,
        kind: d.kind,
      });
      return account;
    }
  }
}

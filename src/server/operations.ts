import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/types";
import { PERMISSIONS, can, type Permission } from "@/lib/permissions";
import { badRequest, forbidden } from "./api";
import { businessTransaction } from "./transaction";
import { hashPassword } from "./auth";
import { priceCart } from "./pricing";
import { consumeStock, restoreStock } from "./stock";
import { nextOrderNumber, serializeOrder, transitionOrder } from "./orders";
import { cartLineSchema } from "@/lib/validation";

const id = z.string().min(1).max(120);
const money = z.number().int().min(0).max(100_000_000);
const positive = money.refine((n) => n > 0, "Must be greater than zero.");
const quantity = z.number().positive().max(1_000_000).multipleOf(0.001);
const text = z.string().trim().min(1).max(200);
const reference = z.string().trim().min(3).max(120);
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const MODULE_PERMISSIONS: Record<string, Permission> = {
  pos: "pos",
  inventory: "inventory",
  people: "people",
  shifts: "shifts",
  delivery: "delivery",
  finance: "finance",
};
export const posSchema = z.object({
  clientId: z.string().uuid(),
  lines: z.array(cartLineSchema).min(1).max(60),
  orderType: z.enum(["DINE_IN", "PICKUP", "DELIVERY"]),
  tableNumber: z.string().trim().max(40).optional(),
  customerName: z.string().trim().min(2).max(60).default("Counter customer"),
  customerPhone: z.string().trim().max(30).default(""),
  addressLine: z.string().trim().max(200).optional(),
  shiftId: id,
  couponCode: z.string().trim().max(32).optional(),
  discount: money.default(0),
  expectedTotal: money,
  paid: z.boolean().default(false),
  paymentMethod: z
    .enum(["CASH_AT_COUNTER", "CASH_ON_DELIVERY"])
    .default("CASH_AT_COUNTER"),
});

async function ownShift(
  tx: Prisma.TransactionClient,
  shiftId: string,
  user: SessionUser,
) {
  const shift = await tx.cashShift.findUniqueOrThrow({
    where: { id: shiftId },
  });
  if (shift.cashierId !== user.id || shift.closedAt)
    throw badRequest(
      "Your shift is closed or belongs to another cashier. Open your own shift.",
    );
  return shift;
}
function validatePos(data: z.infer<typeof posSchema>, user: SessionUser) {
  if (data.discount && !can(user, "promotions"))
    throw forbidden("Promotions permission is required for manual discounts.");
  if (data.orderType === "DINE_IN" && !data.tableNumber)
    throw badRequest("Enter the table number.");
  if (
    data.orderType === "DELIVERY" &&
    (!data.customerPhone || !data.addressLine)
  )
    throw badRequest("Delivery needs a phone number and address.");
  if (
    data.orderType !== "DELIVERY" &&
    data.paymentMethod === "CASH_ON_DELIVERY"
  )
    throw badRequest("Only delivery orders support cash on delivery.");
  if (data.paid && data.paymentMethod === "CASH_ON_DELIVERY")
    throw badRequest(
      "Record cash at the counter, or leave delivery unpaid until collection.",
    );
}
const include = {
  items: { include: { addons: true } },
  events: { orderBy: { createdAt: "asc" as const } },
};
async function posQuote(
  tx: Prisma.TransactionClient,
  data: z.infer<typeof posSchema>,
  user: SessionUser,
) {
  validatePos(data, user);
  const settings = await tx.cafeSetting.findUniqueOrThrow({ where: { id: 1 } });
  const quote = await priceCart(
    {
      lines: data.lines,
      couponCode: data.couponCode,
      orderType: data.orderType,
    },
    settings,
    tx,
  );
  if (quote.couponError && data.couponCode) throw badRequest(quote.couponError);
  if (quote.discount && data.discount)
    throw badRequest("Use a coupon or manual discount, not both.");
  if (data.discount > quote.subtotal)
    throw badRequest("Discount exceeds subtotal.");
  if (data.discount) {
    quote.discount = data.discount;
    quote.tax = Math.round(
      ((quote.subtotal - quote.discount) * settings.taxPercent) / 100,
    );
    quote.deliveryFee =
      data.orderType === "DELIVERY" &&
      !(
        settings.freeDeliveryOver &&
        quote.subtotal - quote.discount >= settings.freeDeliveryOver
      )
        ? settings.deliveryFee
        : 0;
    quote.total =
      quote.subtotal - quote.discount + quote.tax + quote.deliveryFee;
  }
  if (quote.total !== data.expectedTotal)
    throw badRequest(
      `Price changed. Server total is Rs. ${quote.total}. Review the bill and confirm again.`,
    );
  return quote;
}
function itemData(quote: Awaited<ReturnType<typeof posQuote>>) {
  return quote.lines.map((l) => ({
    productId: l.productId,
    productName: l.productName,
    productSlug: l.productSlug,
    productImage: l.productImage,
    unitPrice: l.unitPrice,
    unitCost: l.unitCost,
    addonsTotal: l.addonsTotal,
    quantity: l.quantity,
    lineTotal: l.lineTotal,
    notes: l.notes,
    addons: {
      create: l.addons.map((a) => ({
        addonId: a.id,
        addonName: a.name,
        groupName: a.groupName,
        price: a.price,
      })),
    },
  }));
}
async function createPos(raw: unknown, user: SessionUser) {
  const data = posSchema.parse(raw);
  const hash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return businessTransaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { clientId: data.clientId },
      include,
    });
    if (existing) {
      if (existing.cashierId !== user.id || existing.requestHash !== hash)
        throw badRequest(
          "This offline bill ID was already used with different contents or cashier.",
        );
      return { order: serializeOrder(existing), replayed: true };
    }
    await ownShift(tx, data.shiftId, user);
    const quote = await posQuote(tx, data, user);
    const order = await tx.order.create({
      data: {
        clientId: data.clientId,
        requestHash: hash,
        source: "POS",
        orderNumber: await nextOrderNumber(tx),
        cashierId: user.id,
        shiftId: data.shiftId,
        tableNumber: data.tableNumber,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        addressLine: data.addressLine,
        orderType: data.orderType,
        paymentMethod: data.paymentMethod,
        status: "CONFIRMED",
        confirmedAt: new Date(),
        paymentStatus: data.paid ? "PAID" : "UNPAID",
        subtotal: quote.subtotal,
        discount: quote.discount,
        tax: quote.tax,
        deliveryFee: quote.deliveryFee,
        total: quote.total,
        couponId: quote.coupon?.id,
        couponCode: quote.coupon?.code,
        costRecorded: quote.lines.every((l) => l.costRecorded),
        items: { create: itemData(quote) },
        events: {
          create: {
            status: "CONFIRMED",
            note: `POS bill created by ${user.name}`,
          },
        },
      },
    });
    await consumeStock(tx, order.id, quote.lines);
    if (quote.coupon)
      await tx.coupon.update({
        where: { id: quote.coupon.id },
        data: { usageCount: { increment: 1 } },
      });
    if (data.paid)
      await tx.orderPayment.create({
        data: {
          orderId: order.id,
          shiftId: data.shiftId,
          amount: order.total,
          method: data.paymentMethod,
          reference: `pos:${data.clientId}`,
        },
      });
    return {
      order: serializeOrder(
        await tx.order.findUniqueOrThrow({ where: { id: order.id }, include }),
      ),
    };
  });
}

export async function mutateOperations(
  module: string,
  raw: unknown,
  user: SessionUser,
) {
  const body = z.object({ action: text }).passthrough().parse(raw);
  if (module === "pos" && body.action === "sale") return createPos(body, user);
  if (
    module === "people" &&
    ["user", "access"].includes(body.action) &&
    user.role !== "ADMIN"
  )
    throw forbidden("Only administrators manage user access.");
  if (
    (module === "pos" && body.action === "cancel") ||
    (module === "delivery" && body.action === "status")
  ) {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: id.parse(body.orderId) },
    });
    if (
      module === "pos" &&
      (order.source !== "POS" ||
        (order.cashierId !== user.id && user.role !== "ADMIN"))
    )
      throw forbidden();
    if (module === "delivery" && order.orderType !== "DELIVERY")
      throw badRequest("Select a delivery order.");
    const status =
      module === "pos"
        ? "CANCELLED"
        : z
            .enum([
              "CONFIRMED",
              "PREPARING",
              "READY",
              "OUT_FOR_DELIVERY",
              "DELIVERED",
              "CANCELLED",
            ])
            .parse(body.status);
    return {
      order: serializeOrder(
        await transitionOrder(order, status, `Updated by ${user.name}`),
      ),
    };
  }
  // Hash outside the ledger transaction.
  const passwordHash =
    module === "people" && body.action === "user"
      ? await hashPassword(z.string().min(12).max(128).parse(body.password))
      : undefined;
  return businessTransaction(async (tx) => {
    switch (`${module}:${body.action}`) {
      case "pos:edit": {
        const data = posSchema.extend({ orderId: id }).parse(body);
        const order = await tx.order.findUniqueOrThrow({
          where: { id: data.orderId },
        });
        if (
          order.source !== "POS" ||
          !["PENDING", "CONFIRMED"].includes(order.status) ||
          order.paymentStatus !== "UNPAID" ||
          order.riderId
        )
          throw badRequest(
            "Only unpaid, unassigned, unprepared POS orders can be edited.",
          );
        if (order.cashierId !== user.id && user.role !== "ADMIN")
          throw forbidden();
        if (data.paid)
          throw badRequest("Save edits first, then record payment separately.");
        await ownShift(tx, data.shiftId, user);
        await restoreStock(tx, order.id);
        // Sale movements have been reversed; preserve the ledger but consume again.
        const quote = await posQuote(tx, data, user);
        if (order.couponId)
          await tx.coupon.update({
            where: { id: order.couponId },
            data: { usageCount: { decrement: 1 } },
          });
        if (quote.coupon)
          await tx.coupon.update({
            where: { id: quote.coupon.id },
            data: { usageCount: { increment: 1 } },
          });
        await tx.orderItemAddon.deleteMany({
          where: { orderItem: { orderId: order.id } },
        });
        await tx.orderItem.deleteMany({ where: { orderId: order.id } });
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            orderType: data.orderType,
            tableNumber: data.tableNumber || null,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            addressLine: data.addressLine || null,
            paymentMethod: data.paymentMethod,
            subtotal: quote.subtotal,
            discount: quote.discount,
            tax: quote.tax,
            deliveryFee: quote.deliveryFee,
            total: quote.total,
            couponId: quote.coupon?.id ?? null,
            couponCode: quote.coupon?.code ?? null,
            costRecorded: quote.lines.every((l) => l.costRecorded),
            items: { create: itemData(quote) },
            events: {
              create: {
                status: order.status,
                note: `POS bill edited by ${user.name}; previous total Rs. ${order.total}`,
              },
            },
          },
          include,
        });
        await consumeStock(tx, order.id, quote.lines);
        return { order: serializeOrder(updated) };
      }
      case "pos:complete": {
        const order = await tx.order.findUniqueOrThrow({
          where: { id: id.parse(body.orderId) },
        });
        if (order.cashierId !== user.id && user.role !== "ADMIN")
          throw forbidden();
        if (
          order.orderType === "DELIVERY" ||
          order.paymentStatus !== "PAID" ||
          ["CANCELLED", "DELIVERED"].includes(order.status)
        )
          throw badRequest(
            "Only paid, active counter orders can be handed over.",
          );
        const now = new Date();
        return {
          order: serializeOrder(
            await tx.order.update({
              where: { id: order.id },
              data: {
                status: "DELIVERED",
                readyAt: now,
                deliveredAt: now,
                events: {
                  create: {
                    status: "DELIVERED",
                    note: `Handed over by ${user.name}; payment already recorded`,
                  },
                },
              },
              include,
            }),
          ),
        };
      }
      case "pos:payment": {
        const data = z
          .object({
            orderId: id,
            shiftId: id,
            reference,
            refund: z.boolean().default(false),
          })
          .parse(body);
        await ownShift(tx, data.shiftId, user);
        const order = await tx.order.findUniqueOrThrow({
          where: { id: data.orderId },
        });
        const existing = await tx.orderPayment.findUnique({
          where: { reference: data.reference },
        });
        if (existing) {
          if (
            existing.orderId !== data.orderId ||
            existing.amount < 0 !== data.refund
          )
            throw badRequest("Payment reference already used.");
          return { payment: existing };
        }
        if (order.paymentMethod === "ONLINE")
          throw badRequest(
            "Online payment requires provider verification; it cannot be recorded as cash.",
          );
        if (data.refund && !can(user, "finance"))
          throw forbidden("Finance permission is required for refunds.");
        if (
          order.status === "CANCELLED" ||
          (data.refund
            ? order.paymentStatus !== "PAID"
            : order.paymentStatus !== "UNPAID")
        )
          throw badRequest(
            "Payment is already recorded or order is not payable.",
          );
        const payment = await tx.orderPayment.create({
          data: {
            orderId: order.id,
            shiftId: data.shiftId,
            amount: data.refund ? -order.total : order.total,
            method: order.paymentMethod,
            reference: data.reference,
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: data.refund ? "REFUNDED" : "PAID",
            ...(!order.cashierId
              ? { cashierId: user.id, shiftId: data.shiftId }
              : {}),
            events: {
              create: {
                status: order.status,
                note: `${data.refund ? "Refund" : "Payment"} recorded by ${user.name}; ref ${data.reference}`,
              },
            },
          },
        });
        return { payment };
      }
      case "inventory:item": {
        const data = z
          .object({
            name: text,
            unit: z.string().trim().min(1).max(30),
            lowStock: money,
          })
          .parse(body);
        return { item: await tx.inventoryItem.create({ data }) };
      }
      case "inventory:item-update": {
        const data = z
          .object({
            itemId: id,
            name: text,
            lowStock: z.number().min(0).max(1000000).multipleOf(0.001),
            isActive: z.boolean(),
          })
          .parse(body);
        return {
          item: await tx.inventoryItem.update({
            where: { id: data.itemId },
            data: {
              name: data.name,
              lowStock: data.lowStock,
              isActive: data.isActive,
            },
          }),
        };
      }
      case "inventory:supplier-update": {
        const data = z
          .object({
            supplierId: id,
            name: text,
            phone: z.string().max(40).optional(),
            address: z.string().max(200).optional(),
            isActive: z.boolean(),
          })
          .parse(body);
        return {
          supplier: await tx.supplier.update({
            where: { id: data.supplierId },
            data: {
              name: data.name,
              phone: data.phone || null,
              address: data.address || null,
              isActive: data.isActive,
            },
          }),
        };
      }
      case "inventory:adjust": {
        const data = z
          .object({
            inventoryItemId: id,
            quantity: z
              .number()
              .min(-1_000_000)
              .max(1_000_000)
              .multipleOf(0.001)
              .refine((n) => n !== 0),
            reason: text,
          })
          .parse(body);
        const item = await tx.inventoryItem.findUniqueOrThrow({
          where: { id: data.inventoryItemId },
        });
        if (Number(item.quantity) + data.quantity < 0)
          throw badRequest("Adjustment would make stock negative.");
        await tx.stockMovement.create({
          data: {
            ...data,
            unitCost: item.averageCost,
            reason: `ADJUSTMENT: ${data.reason}`,
          },
        });
        return {
          item: await tx.inventoryItem.update({
            where: { id: item.id },
            data: { quantity: { increment: data.quantity } },
          }),
        };
      }
      case "inventory:recipe": {
        const data = z
          .object({
            productId: id,
            lines: z.array(z.object({ inventoryItemId: id, quantity })).max(40),
          })
          .parse(body);
        if (
          new Set(data.lines.map((l) => l.inventoryItemId)).size !==
          data.lines.length
        )
          throw badRequest("Recipe contains duplicate ingredients.");
        await tx.recipeLine.deleteMany({
          where: { productId: data.productId },
        });
        await tx.product.findUniqueOrThrow({ where: { id: data.productId } });
        await tx.recipeLine.createMany({
          data: data.lines.map((l) => ({ ...l, productId: data.productId })),
        });
        return { ok: true };
      }
      case "inventory:supplier": {
        const data = z
          .object({
            name: text,
            phone: z.string().max(40).optional(),
            address: z.string().max(200).optional(),
          })
          .parse(body);
        return { supplier: await tx.supplier.create({ data }) };
      }
      case "inventory:purchase": {
        const data = z
          .object({
            supplierId: id,
            reference,
            lines: z
              .array(
                z.object({
                  inventoryItemId: id,
                  quantity,
                  unitCost: z
                    .number()
                    .min(0)
                    .max(100_000_000)
                    .multipleOf(0.0001),
                }),
              )
              .min(1)
              .max(80),
          })
          .parse(body);
        if (
          new Set(data.lines.map((l) => l.inventoryItemId)).size !==
          data.lines.length
        )
          throw badRequest("Combine repeated purchase items.");
        const supplier = await tx.supplier.findUniqueOrThrow({
          where: { id: data.supplierId },
        });
        if (!supplier.isActive)
          throw badRequest(
            "Reactivate the supplier before recording a new purchase.",
          );
        const lines = data.lines.map((l) => ({
          ...l,
          lineTotal: Math.round(l.quantity * l.unitCost),
        }));
        const total = money.parse(lines.reduce((s, l) => s + l.lineTotal, 0));
        const purchase = await tx.purchase.create({
          data: {
            supplierId: data.supplierId,
            reference: data.reference,
            total,
            lines: { create: lines },
          },
        });
        for (const line of lines) {
          const item = await tx.inventoryItem.findUniqueOrThrow({
            where: { id: line.inventoryItemId },
          });
          const newQty = Number(item.quantity) + line.quantity;
          const averageCost =
            Math.round(
              ((Number(item.quantity) * Number(item.averageCost) +
                line.lineTotal) /
                newQty) *
                10000,
            ) / 10000;
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { quantity: { increment: line.quantity }, averageCost },
          });
          await tx.stockMovement.create({
            data: {
              inventoryItemId: item.id,
              quantity: line.quantity,
              unitCost: line.unitCost,
              reason: `PURCHASE ${data.reference}`,
            },
          });
        }
        return { purchase };
      }
      case "inventory:vendor-payment": {
        const data = z
          .object({ supplierId: id, amount: positive, reference })
          .parse(body);
        return { payment: await tx.supplierPayment.create({ data }) };
      }
      case "people:user": {
        const data = z
          .object({
            name: text,
            email: z
              .string()
              .email()
              .max(120)
              .transform((s) => s.toLowerCase()),
            role: z.enum(["ADMIN", "STAFF"]),
            permissions: z.array(z.enum(PERMISSIONS)).default([]),
          })
          .parse(body);
        return {
          user: await tx.user.create({
            data: { ...data, passwordHash: passwordHash! },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              permissions: true,
            },
          }),
        };
      }
      case "people:access": {
        const data = z
          .object({
            userId: id,
            role: z.enum(["ADMIN", "STAFF", "CUSTOMER"]),
            isActive: z.boolean(),
            permissions: z.array(z.enum(PERMISSIONS)),
          })
          .parse(body);
        if (data.userId === user.id)
          throw badRequest("You cannot change your own access.");
        const current = await tx.user.findUniqueOrThrow({
          where: { id: data.userId },
        });
        if (
          current.role === "ADMIN" &&
          (!data.isActive || data.role !== "ADMIN") &&
          (await tx.user.count({ where: { role: "ADMIN", isActive: true } })) <=
            1
        )
          throw badRequest("An active administrator must remain.");
        return {
          user: await tx.user.update({
            where: { id: data.userId },
            data: {
              role: data.role,
              isActive: data.isActive,
              permissions: data.permissions,
            },
            select: {
              id: true,
              name: true,
              role: true,
              permissions: true,
              isActive: true,
            },
          }),
        };
      }
      case "people:employee": {
        const data = z
          .object({
            name: text,
            title: text,
            phone: z.string().max(40).optional(),
            userId: id.optional(),
            monthlySalary: money,
          })
          .parse(body);
        return { employee: await tx.employee.create({ data }) };
      }
      case "people:employee-update": {
        const data = z
          .object({
            employeeId: id,
            name: text,
            title: text,
            phone: z.string().max(40).optional(),
            monthlySalary: money,
            isActive: z.boolean(),
          })
          .parse(body);
        const { employeeId, ...update } = data;
        return {
          employee: await tx.employee.update({
            where: { id: employeeId },
            data: update,
          }),
        };
      }
      case "people:attendance": {
        const data = z
          .object({ employeeId: id, clockOut: z.boolean().default(false) })
          .parse(body);
        const day = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Karachi",
        }).format(new Date());
        const existing = await tx.attendance.findUnique({
          where: { employeeId_day: { employeeId: data.employeeId, day } },
        });
        if (data.clockOut) {
          // Also allow closing an overnight attendance record on the next day.
          const open = await tx.attendance.findFirst({
            where: { employeeId: data.employeeId, clockOut: null },
            orderBy: { clockIn: "desc" },
          });
          if (!open) throw badRequest("No open attendance record.");
          return {
            attendance: await tx.attendance.update({
              where: { id: open.id },
              data: { clockOut: new Date() },
            }),
          };
        }
        if (
          existing ||
          (await tx.attendance.findFirst({
            where: { employeeId: data.employeeId, clockOut: null },
          }))
        )
          throw badRequest(
            "Attendance already exists today or a previous check-in is still open.",
          );
        return {
          attendance: await tx.attendance.create({
            data: { employeeId: data.employeeId, day },
          }),
        };
      }
      case "people:salary": {
        const data = z
          .object({ employeeId: id, period, amount: positive, reference })
          .parse(body);
        return { payment: await tx.salaryPayment.create({ data }) };
      }
      case "shifts:open": {
        const data = z.object({ openingCash: money }).parse(body);
        if (!can(user, "pos"))
          throw forbidden("POS access required to open a cashier shift.");
        return {
          shift: await tx.cashShift.create({
            data: {
              cashierId: user.id,
              activeKey: user.id,
              openingCash: data.openingCash,
            },
          }),
        };
      }
      case "shifts:movement": {
        const data = z
          .object({
            shiftId: id,
            amount: z
              .number()
              .int()
              .min(-100_000_000)
              .max(100_000_000)
              .refine((n) => n !== 0),
            reason: text,
          })
          .parse(body);
        await ownShift(tx, data.shiftId, user);
        return { movement: await tx.cashMovement.create({ data }) };
      }
      case "shifts:close": {
        const data = z
          .object({
            shiftId: id,
            closingCash: money,
            handoverToId: id.optional(),
            note: z.string().max(300).optional(),
          })
          .parse(body);
        const shift = await ownShift(tx, data.shiftId, user);
        if (data.handoverToId) {
          const recipient = await tx.user.findUniqueOrThrow({
            where: { id: data.handoverToId },
          });
          if (
            recipient.id === user.id ||
            !recipient.isActive ||
            !can(recipient, "pos")
          )
            throw badRequest("Choose another active cashier for the handover.");
        }
        const payment = await tx.orderPayment.aggregate({
          where: { shiftId: shift.id, method: { not: "ONLINE" } },
          _sum: { amount: true },
        });
        const moves = await tx.cashMovement.aggregate({
          where: { shiftId: shift.id },
          _sum: { amount: true },
        });
        const expectedCash =
          shift.openingCash +
          (payment._sum.amount || 0) +
          (moves._sum.amount || 0);
        return {
          shift: await tx.cashShift.update({
            where: { id: shift.id },
            data: {
              closedAt: new Date(),
              activeKey: null,
              expectedCash,
              closingCash: data.closingCash,
              variance: data.closingCash - expectedCash,
              handoverToId: data.handoverToId,
              note: data.note,
            },
          }),
        };
      }
      case "delivery:rider": {
        const data = z
          .object({
            code: z.string().trim().min(2).max(30),
            name: text,
            phone: z.string().min(7).max(40),
          })
          .parse(body);
        return { rider: await tx.rider.create({ data }) };
      }
      case "delivery:rider-update": {
        const data = z
          .object({
            riderId: id,
            name: text,
            phone: z.string().min(7).max(40),
            isActive: z.boolean(),
          })
          .parse(body);
        return {
          rider: await tx.rider.update({
            where: { id: data.riderId },
            data: {
              name: data.name,
              phone: data.phone,
              isActive: data.isActive,
            },
          }),
        };
      }
      case "delivery:assign": {
        const data = z.object({ riderId: id, orderId: id }).parse(body);
        const rider = await tx.rider.findUniqueOrThrow({
          where: { id: data.riderId },
        });
        const order = await tx.order.findUniqueOrThrow({
          where: { id: data.orderId },
        });
        if (
          !rider.isActive ||
          order.orderType !== "DELIVERY" ||
          ["CANCELLED", "DELIVERED", "OUT_FOR_DELIVERY"].includes(order.status)
        )
          throw badRequest("Order cannot be assigned to this rider.");
        return {
          order: await tx.order.update({
            where: { id: order.id },
            data: {
              riderId: rider.id,
              commissionRate: 15,
              commission: Math.round((order.subtotal - order.discount) * 0.15),
              events: {
                create: {
                  status: order.status,
                  note: `Assigned to rider ${rider.code} by ${user.name}`,
                },
              },
            },
          }),
        };
      }
      case "delivery:settle": {
        if (!can(user, "finance"))
          throw forbidden("Finance access required to settle commissions.");
        const data = z
          .object({ riderId: id, orderIds: z.array(id).min(1).max(200) })
          .parse(body);
        const orders = await tx.order.findMany({
          where: {
            id: { in: data.orderIds },
            riderId: data.riderId,
            status: "DELIVERED",
            paymentStatus: "PAID",
            commissionPaidAt: null,
          },
        });
        if (orders.length !== new Set(data.orderIds).size)
          throw badRequest(
            "Some commissions are not eligible or already settled.",
          );
        await tx.order.updateMany({
          where: { id: { in: data.orderIds } },
          data: { commissionPaidAt: new Date() },
        });
        return {
          settled: orders.length,
          amount: orders.reduce((s, o) => s + o.commission, 0),
        };
      }
      case "finance:expense": {
        const data = z
          .object({
            category: text,
            description: text,
            amount: positive,
            reference,
          })
          .parse(body);
        return { expense: await tx.expense.create({ data }) };
      }
      default:
        throw badRequest("Unknown operation.");
    }
  });
}

export async function readOperations(
  module: string,
  user: SessionUser,
  url: URL,
) {
  switch (module) {
    case "pos": {
      const [products, settings, shift, orders] = await Promise.all([
        prisma.product.findMany({
          where: { isAvailable: true },
          include: {
            category: true,
            addonGroups: {
              include: {
                addonGroup: {
                  include: { addons: { where: { isAvailable: true } } },
                },
              },
            },
          },
          orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
        }),
        prisma.cafeSetting.findUniqueOrThrow({ where: { id: 1 } }),
        prisma.cashShift.findFirst({
          where: { cashierId: user.id, closedAt: null },
        }),
        prisma.order.findMany({
          where: {
            ...(user.role === "ADMIN"
              ? {}
              : {
                  OR: [
                    { cashierId: user.id },
                    { source: "WEB", cashierId: null },
                  ],
                }),
            status: { not: "CANCELLED" },
          },
          include,
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      ]);
      return {
        products,
        settings,
        shift,
        orders: orders.map((o) => ({
          ...serializeOrder(o),
          cashierId: o.cashierId,
          shiftId: o.shiftId,
          source: o.source,
          tableNumber: o.tableNumber,
        })),
      };
    }
    case "inventory": {
      const [items, suppliers, purchases, movements, products] =
        await Promise.all([
          prisma.inventoryItem.findMany({ orderBy: { name: "asc" } }),
          prisma.supplier.findMany({
            include: {
              purchases: { select: { total: true } },
              payments: { select: { amount: true } },
            },
          }),
          prisma.purchase.findMany({
            include: { supplier: true, lines: { include: { item: true } } },
            orderBy: { createdAt: "desc" },
            take: 200,
          }),
          prisma.stockMovement.findMany({
            include: { item: true },
            orderBy: { createdAt: "desc" },
            take: 200,
          }),
          prisma.product.findMany({
            select: {
              id: true,
              name: true,
              stock: true,
              soldCount: true,
              isAvailable: true,
              recipe: true,
            },
            orderBy: { soldCount: "desc" },
          }),
        ]);
      return {
        items: items.map((i) => ({
          ...i,
          low: Number(i.quantity) <= Number(i.lowStock),
        })),
        suppliers: suppliers.map((s) => ({
          ...s,
          balance:
            s.purchases.reduce((sum, p) => sum + p.total, 0) -
            s.payments.reduce((sum, p) => sum + p.amount, 0),
        })),
        purchases,
        movements,
        products,
      };
    }
    case "people": {
      const [employees, users] = await Promise.all([
        prisma.employee.findMany({
          include: {
            attendance: { orderBy: { clockIn: "desc" }, take: 60 },
            salaryPayments: { orderBy: { paidAt: "desc" }, take: 36 },
          },
          orderBy: { name: "asc" },
        }),
        user.role === "ADMIN"
          ? prisma.user.findMany({
              where: { role: { in: ["ADMIN", "STAFF"] } },
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                permissions: true,
                isActive: true,
              },
            })
          : Promise.resolve([]),
      ]);
      return { employees, users, permissions: PERMISSIONS };
    }
    case "shifts": {
      const [shifts, cashiers] = await Promise.all([
        prisma.cashShift.findMany({
          where: user.role === "ADMIN" ? {} : { cashierId: user.id },
          include: {
            cashier: { select: { id: true, name: true } },
            payments: true,
            movements: true,
            orders: {
              select: {
                id: true,
                orderNumber: true,
                total: true,
                status: true,
              },
            },
          },
          orderBy: { openedAt: "desc" },
          take: 100,
        }),
        prisma.user.findMany({
          where: {
            isActive: true,
            OR: [
              { role: "ADMIN" },
              { role: "STAFF", permissions: { has: "pos" } },
            ],
          },
          select: { id: true, name: true },
        }),
      ]);
      return {
        shifts: shifts.map((s) => ({
          ...s,
          liveExpected:
            s.openingCash +
            s.payments
              .filter((p) => p.method !== "ONLINE")
              .reduce((n, p) => n + p.amount, 0) +
            s.movements.reduce((n, m) => n + m.amount, 0),
          sales: s.orders
            .filter((o) => o.status !== "CANCELLED")
            .reduce((n, o) => n + o.total, 0),
        })),
        cashiers,
      };
    }
    case "delivery": {
      const [riders, orders] = await Promise.all([
        prisma.rider.findMany({
          include: {
            orders: {
              select: {
                id: true,
                status: true,
                commission: true,
                commissionPaidAt: true,
                deliveredAt: true,
                placedAt: true,
              },
            },
          },
          orderBy: { code: "asc" },
        }),
        prisma.order.findMany({
          where: { orderType: "DELIVERY", status: { not: "CANCELLED" } },
          include: { rider: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
      ]);
      return {
        riders: riders.map((r) => {
          const completed = r.orders.filter((o) => o.status === "DELIVERED");
          return {
            ...r,
            delivered: completed.length,
            active: r.orders.filter(
              (o) => !["CANCELLED", "DELIVERED"].includes(o.status),
            ).length,
            earned: completed.reduce((s, o) => s + o.commission, 0),
            due: completed
              .filter((o) => !o.commissionPaidAt)
              .reduce((s, o) => s + o.commission, 0),
            averageMinutes: completed.length
              ? Math.round(
                  completed.reduce(
                    (s, o) =>
                      s +
                      ((o.deliveredAt?.getTime() ?? o.placedAt.getTime()) -
                        o.placedAt.getTime()) /
                        60000,
                    0,
                  ) / completed.length,
                )
              : null,
          };
        }),
        orders,
      };
    }
    case "finance":
      return financialReport(url);
    default:
      throw badRequest("Unknown module.");
  }
}

async function financialReport(url: URL) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
  }).format(new Date());
  const fromText = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .parse(url.searchParams.get("from") || day);
  const toText = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .parse(url.searchParams.get("to") || day);
  const from = new Date(`${fromText}T00:00:00+05:00`),
    to = new Date(new Date(`${toText}T00:00:00+05:00`).getTime() + 86400000);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    to <= from ||
    to.getTime() - from.getTime() > 366 * 86400000
  )
    throw badRequest("Select a valid range of at most 366 days.");
  const range = { gte: from, lt: to };
  const [
    orders,
    expenses,
    salaries,
    payments,
    suppliers,
    purchases,
    inventory,
    commissionsPaid,
  ] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: "DELIVERED",
        paymentStatus: "PAID",
        OR: [{ deliveredAt: range }, { deliveredAt: null, createdAt: range }],
      },
      include: {
        items: true,
        rider: true,
        cashier: { select: { name: true } },
      },
    }),
    prisma.expense.findMany({
      where: { incurredAt: range },
      orderBy: { incurredAt: "desc" },
    }),
    prisma.salaryPayment.findMany({
      where: { paidAt: range },
      include: { employee: { select: { name: true } } },
    }),
    prisma.orderPayment.findMany({ where: { createdAt: range } }),
    prisma.supplier.findMany({
      include: {
        purchases: {
          where: { createdAt: { lt: to } },
          select: { total: true },
        },
        payments: {
          where: { createdAt: { lt: to } },
          select: { amount: true },
        },
      },
    }),
    prisma.purchase.aggregate({
      where: { createdAt: range },
      _sum: { total: true },
    }),
    prisma.inventoryItem.findMany(),
    prisma.order.aggregate({
      where: { commissionPaidAt: range },
      _sum: { commission: true },
    }),
  ]);
  const groups = new Map<
    string,
    { date: string; sales: number; orders: number }
  >();
  const products = new Map<
    string,
    { name: string; quantity: number; gross: number; cost: number }
  >();
  const cashiers = new Map<
    string,
    { name: string; orders: number; sales: number }
  >();
  let sales = 0,
    tax = 0,
    deliveryFees = 0,
    discount = 0,
    knownCost = 0,
    commission = 0,
    missingCostOrders = 0;
  for (const o of orders) {
    sales += o.subtotal - o.discount;
    tax += o.tax;
    deliveryFees += o.deliveryFee;
    discount += o.discount;
    commission += o.commission;
    if (!o.costRecorded) missingCostOrders++;
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
    }).format(o.deliveredAt || o.createdAt);
    const g = groups.get(key) || { date: key, sales: 0, orders: 0 };
    g.sales += o.total;
    g.orders++;
    groups.set(key, g);
    const cashierKey = o.cashierId || "web";
    const c = cashiers.get(cashierKey) || {
      name: o.cashier?.name || "Website / historical",
      orders: 0,
      sales: 0,
    };
    c.orders++;
    c.sales += o.total;
    cashiers.set(cashierKey, c);
    for (const item of o.items) {
      const cost = item.unitCost * item.quantity;
      knownCost += cost;
      const p = products.get(item.productId || item.productName) || {
        name: item.productName,
        quantity: 0,
        gross: 0,
        cost: 0,
      };
      p.quantity += item.quantity;
      p.gross += item.lineTotal;
      p.cost += cost;
      products.set(item.productId || item.productName, p);
    }
  }
  const operatingExpenses = expenses.reduce((s, e) => s + e.amount, 0),
    salaryExpense = salaries.reduce((s, e) => s + e.amount, 0);
  const contribution =
    sales +
    deliveryFees -
    knownCost -
    operatingExpenses -
    salaryExpense -
    commission;
  return {
    from: fromText,
    to: toText,
    timezone: "Asia/Karachi",
    summary: {
      orders: orders.length,
      netMerchandiseSales: sales,
      discount,
      tax,
      deliveryFees,
      grossCollectedSales: sales + tax + deliveryFees,
      netRevenue: sales + deliveryFees,
      knownCost,
      missingCostOrders,
      operatingExpenses,
      salaries: salaryExpense,
      commission,
      commissionsPaid: commissionsPaid._sum.commission || 0,
      netProfit: missingCostOrders ? null : contribution,
      contributionBeforeUnknownCosts: contribution,
      paymentReceipts: payments.reduce((s, p) => s + Math.max(0, p.amount), 0),
      refunds: payments.reduce((s, p) => s + Math.max(0, -p.amount), 0),
      purchases: purchases._sum.total || 0,
      inventoryValue: Math.round(
        inventory.reduce(
          (s, i) => s + Number(i.quantity) * Number(i.averageCost),
          0,
        ),
      ),
      lowStockItems: inventory.filter(
        (i) => Number(i.quantity) <= Number(i.lowStock),
      ).length,
    },
    daily: [...groups.values()].sort((a, b) => a.date.localeCompare(b.date)),
    products: [...products.values()].sort((a, b) => b.quantity - a.quantity),
    cashiers: [...cashiers.values()],
    vendors: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      purchased: s.purchases.reduce((sum, p) => sum + p.total, 0),
      paid: s.payments.reduce((sum, p) => sum + p.amount, 0),
      balance:
        s.purchases.reduce((sum, p) => sum + p.total, 0) -
        s.payments.reduce((sum, p) => sum + p.amount, 0),
    })),
    expenses,
    salaries,
  };
}

import { BUSINESS_CAPABILITIES } from "@/lib/business-access";
import { dateValue } from "@/lib/business-math";
import { z } from "zod";
import { cartLineSchema } from "@/lib/validation";
export const money = z
  .string()
  .regex(
    /^\d{1,12}(?:\.\d{1,2})?$/,
    "Enter a positive amount with at most two decimal places.",
  );
export const qty = z
  .string()
  .regex(/^\d{1,12}(?:\.\d{1,4})?$/, "Use at most four quantity decimals.")
  .refine((v) => Number(v) > 0, "Quantity must be positive.");
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    try {
      dateValue(v);
      return true;
    } catch {
      return false;
    }
  }, "Choose a real calendar date.");
export const note = z
  .string()
  .trim()
  .min(3, "Add a clear reason or reference.")
  .max(300);
const base = { requestId: z.string().uuid() };
export const schemas = {
  delivery: z.discriminatedUnion("action", [
    z.object({
      ...base,
      action: z.literal("SAVE"),
      id: z.string().optional(),
      version: z.string().optional(),
      code: z
        .string()
        .trim()
        .min(2)
        .max(30)
        .regex(/^[A-Za-z0-9_-]+$/)
        .transform((v) => v.toUpperCase()),
      name: z.string().trim().min(2).max(80),
      phone: z.string().trim().min(7).max(30),
      isActive: z.boolean(),
    }),
    z.object({
      ...base,
      action: z.literal("ASSIGN"),
      riderId: z.string().min(1),
      orderId: z.string().min(1),
      version: z.string(),
      note,
    }),
    z.object({
      ...base,
      action: z.literal("SETTLE"),
      riderId: z.string().min(1),
      accountId: z.string().min(1),
      amount: money,
      note,
    }),
    z.object({
      ...base,
      action: z.literal("RECOVER"),
      riderId: z.string().min(1),
      accountId: z.string().min(1),
      amount: money,
      note,
    }),
    z.object({
      ...base,
      action: z.literal("REMIT"),
      riderId: z.string().min(1),
      accountId: z.string().min(1),
      amount: money,
      note,
    }),
  ]),
  ingredients: z.discriminatedUnion("action", [
    z.object({
      ...base,
      action: z.literal("SAVE"),
      id: z.string().optional(),
      version: z.string().optional(),
      name: z.string().trim().min(2).max(80),
      unit: z.enum(["G", "ML", "PCS"]),
      reorderAt: z.string().regex(/^\d{1,12}(?:\.\d{1,4})?$/),
      isActive: z.boolean(),
    }),
    z.object({
      ...base,
      action: z.literal("ADJUST"),
      ingredientId: z.string(),
      version: z.string().optional(),
      kind: z.enum(["OPENING", "COUNT", "WASTE", "STAFF_MEAL", "OUT", "IN"]),
      quantity: z.string().regex(/^\d{1,12}(?:\.\d{1,4})?$/),
      value: money.optional(),
      note,
      date,
    }),
  ]),
  recipes: z.object({
    ...base,
    productId: z.string().optional(),
    addonId: z.string().optional(),
    version: z.string().optional(),
    required: z.boolean().default(true),
    yieldUnits: qty,
    note: z.string().max(300).default(""),
    lines: z
      .array(z.object({ ingredientId: z.string(), quantity: qty }))
      .max(60),
  }),
  suppliers: z.object({
    ...base,
    id: z.string().optional(),
    version: z.string().optional(),
    name: z.string().trim().min(2).max(100),
    phone: z.string().max(30).default(""),
    email: z.string().email().or(z.literal("")).default(""),
    address: z.string().max(200).default(""),
    isActive: z.boolean().default(true),
  }),
  customers: z.object({
    ...base,
    id: z.string().optional(),
    version: z.string().optional(),
    name: z.string().trim().min(2).max(100),
    phone: z.string().max(30).default(""),
    email: z.string().email().or(z.literal("")).default(""),
    address: z.string().max(200).default(""),
    isActive: z.boolean().default(true),
    creditLimit: money,
  }),
  purchases: z.discriminatedUnion("action", [
    z.object({
      ...base,
      action: z.literal("POST"),
      supplierId: z.string(),
      invoiceNumber: z.string().trim().min(1).max(80),
      date,
      note: z.string().max(300).default(""),
      lines: z
        .array(
          z.object({
            ingredientId: z.string(),
            quantity: qty,
            totalCost: money,
          }),
        )
        .min(1)
        .max(60),
      paid: money,
      accountId: z.string().optional(),
    }),
    z.object({
      ...base,
      action: z.literal("RETURN"),
      lineId: z.string(),
      quantity: qty,
      note,
      date,
    }),
  ]),
  payments: z.object({
    ...base,
    kind: z.enum([
      "SUPPLIER_PAYMENT",
      "SUPPLIER_REFUND",
      "PAYROLL_PAYMENT",
      "SALARY_BALANCE_PAYMENT",
      "STAFF_ADVANCE",
      "STAFF_REPAYMENT",
      "CUSTOMER_RECEIPT",
    ]),
    partyId: z.string(),
    amount: money,
    accountId: z.string(),
    date,
    note,
    purchaseId: z.string().optional(),
    payrollId: z.string().optional(),
  }),
  staff: z.object({
    ...base,
    id: z.string().optional(),
    version: z.string().optional(),
    name: z.string().trim().min(2).max(100),
    code: z.string().trim().min(1).max(30),
    phone: z.string().max(30).default(""),
    designation: z.string().trim().min(2).max(60),
    payBasis: z.enum(["MONTHLY", "DAILY"]),
    basePay: money,
    overtimeRate: money,
    joinedOn: date,
    leftOn: date.nullable().optional(),
    isActive: z.boolean(),
    notes: z.string().max(500).default(""),
    login: z
      .object({
        email: z.string().trim().email().toLowerCase(),
        password: z.string().min(8).max(72),
        profile: z.enum(["MANAGER", "CASHIER", "WAITER", "CHEF"]),
      })
      .optional(),
  }),
  attendance: z.object({
    ...base,
    id: z.string().optional(),
    version: z.string().optional(),
    employeeId: z.string(),
    date,
    status: z.enum([
      "PRESENT",
      "ABSENT",
      "PAID_LEAVE",
      "UNPAID_LEAVE",
      "HALF_DAY",
    ]),
    clockIn: z.string().datetime().nullable().optional(),
    clockOut: z.string().datetime().nullable().optional(),
    overtimeHours: z
      .string()
      .regex(/^\d{1,2}(?:\.\d{1,4})?$/)
      .refine((v) => Number(v) <= 24),
    notes: z.string().max(300).default(""),
  }),
  payroll: z.discriminatedUnion("action", [
    z.object({
      ...base,
      action: z.literal("DRAFT"),
      employeeId: z.string(),
      start: date,
      end: date,
      bonus: money,
      deduction: money,
      recoverAdvance: z.boolean(),
      note,
      id: z.string().optional(),
      version: z.string().optional(),
    }),
    z.object({
      ...base,
      action: z.literal("POST"),
      id: z.string(),
      version: z.string(),
      acknowledgeAttendance: z.boolean(),
    }),
    z.object({ ...base, action: z.literal("REVERSE"), id: z.string(), note }),
  ]),
  cash: z.object({
    ...base,
    action: z.enum(["OPEN", "CLOSE", "REVIEW"]),
    drawerId: z.string().optional(),
    shiftId: z.string().optional(),
    amount: money,
    note: z.string().max(300).default(""),
    denominations: z
      .array(
        z.object({
          value: z.enum([
            "5000",
            "1000",
            "500",
            "100",
            "50",
            "20",
            "10",
            "5",
            "2",
            "1",
            "0.5",
          ]),
          count: z.number().int().min(0).max(100000),
        }),
      )
      .max(11)
      .optional(),
  }),
  procurement: z.discriminatedUnion("action", [
    z.object({
      ...base,
      action: z.literal("DRAFT"),
      supplierId: z.string(),
      expectedOn: date,
      note,
      lines: z
        .array(
          z.object({
            ingredientId: z.string(),
            quantity: qty,
            totalCost: money,
          }),
        )
        .min(1)
        .max(60),
    }),
    z.object({
      ...base,
      action: z.enum(["APPROVE", "CANCEL"]),
      id: z.string(),
      version: z.string(),
      note,
    }),
    z.object({
      ...base,
      action: z.literal("RECEIVE"),
      id: z.string(),
      version: z.string(),
      invoiceNumber: z.string().trim().min(1).max(80),
      date,
      note,
      paid: money,
      accountId: z.string().optional(),
    }),
  ]),
  stockcounts: z.discriminatedUnion("action", [
    z.object({
      ...base,
      action: z.literal("DRAFT"),
      date,
      note,
      lines: z
        .array(
          z.object({
            ingredientId: z.string(),
            version: z.string(),
            counted: z.string().regex(/^\d{1,12}(?:\.\d{1,4})?$/),
            addedValue: money.optional(),
          }),
        )
        .min(1)
        .max(500),
    }),
    z.object({
      ...base,
      action: z.enum(["POST", "CANCEL"]),
      id: z.string(),
      version: z.string(),
      note,
    }),
  ]),
  approvals: z.discriminatedUnion("action", [
    z.object({
      ...base,
      action: z.literal("REQUEST"),
      kind: z.enum(["REFUND", "DISCOUNT"]),
      amount: money,
      reason: note,
      orderId: z.string().optional(),
      lines: z.array(cartLineSchema).min(1).max(60).optional(),
    }),
    z.object({
      ...base,
      action: z.literal("DECIDE"),
      id: z.string(),
      approved: z.boolean(),
      note,
    }),
  ]),
  money: z.object({
    ...base,
    kind: z.enum([
      "EXPENSE",
      "OPENING",
      "CAPITAL",
      "DRAW",
      "TRANSFER",
      "CORRECTION",
      "CORRECTION_IN",
    ]),
    amount: money,
    accountId: z.string(),
    toAccountId: z.string().optional(),
    expenseCode: z.string().optional(),
    date,
    note,
  }),
  reversal: z.object({ ...base, id: z.string(), note }),
  opening: z.object({
    ...base,
    partyId: z.string(),
    kind: z.enum([
      "SUPPLIER_DUE",
      "CUSTOMER_DUE",
      "SALARY_DUE",
      "STAFF_ADVANCE",
    ]),
    amount: money,
    date,
    note,
  }),
  tables: z.discriminatedUnion("action", [
    z.object({
      ...base,
      action: z.literal("SAVE"),
      id: z.string().optional(),
      name: z.string().trim().min(1).max(40),
      seats: z.number().int().min(1).max(100),
      isActive: z.boolean(),
    }),
    z.object({
      ...base,
      action: z.literal("OPEN"),
      tableId: z.string(),
      waiterId: z.string().optional(),
      guestCount: z.number().int().min(1).max(100),
    }),
    z.object({ ...base, action: z.literal("CLOSE"), sessionId: z.string() }),
    z.object({
      ...base,
      action: z.literal("TRANSFER"),
      sessionId: z.string(),
      tableId: z.string(),
      note,
    }),
    z.object({
      ...base,
      action: z.enum(["MERGE", "SPLIT"]),
      sessionId: z.string(),
      targetSessionId: z.string(),
      orderIds: z.array(z.string()).min(1).max(100).optional(),
      note,
    }),
    z.object({
      ...base,
      action: z.literal("PAY"),
      sessionId: z.string(),
      amount: money,
      accountId: z.string(),
      note,
    }),
  ]),
  setup: z.discriminatedUnion("action", [
    z.object({
      ...base,
      action: z.literal("CONFIG"),
      enabled: z.boolean().optional(),
      lockedThrough: date.nullable().optional(),
      note,
    }),
    z.object({
      ...base,
      action: z.literal("ACCESS"),
      customPermissions: z.boolean().default(false),
      permissions: z
        .array(
          z
            .string()
            .refine(
              (value) => BUSINESS_CAPABILITIES.includes(value),
              "Unknown staff permission.",
            ),
        )
        .max(30)
        .default([]),
      userId: z.string(),
      profile: z.enum(["MANAGER", "CASHIER", "WAITER", "CHEF"]),
      employeeId: z.string().nullable().optional(),
    }),
    z.object({
      ...base,
      action: z.literal("ACCOUNT"),
      name: z.string().trim().min(2).max(60),
      kind: z.enum(["CASH", "BANK", "WALLET"]),
    }),
  ]),
};
export type Module = keyof typeof schemas;

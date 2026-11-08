import {
  handle,
  json,
  requireAdmin,
  badRequest,
  parseBody,
} from "@/server/api";
import { z } from "zod";
import { cartLineSchema } from "@/lib/validation";
import { createCafeOrder } from "@/server/checkout";
import { serializeOrder } from "@/server/orders";
import { prisma } from "@/lib/prisma";
import { getMealCatalog } from "@/server/products";
import { getSettings, publicSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const actor = await requireAdmin("pos");
  const [catalog, settings, config, shift, sessions] = await Promise.all([
    getMealCatalog(2000),
    getSettings(),
    prisma.businessConfig.findUnique({ where: { id: 1 } }),
    prisma.cashShift.findFirst({
      where: {
        openedById: actor.id,
        closedAt: null,
        drawer: { isActive: true, account: { isActive: true } },
      },
      include: { drawer: { select: { name: true, accountId: true } } },
      orderBy: { openedAt: "desc" },
    }),
    prisma.tableSession.findMany({
      where: { closedAt: null, table: { isActive: true } },
      select: { id: true, table: { select: { name: true } } },
      orderBy: { openedAt: "desc" },
    }),
  ]);
  if (!config?.enabled)
    throw badRequest(
      "Activate accounting before preparing the offline counter.",
    );
  if (catalog.truncated)
    throw badRequest(
      "The offline catalogue exceeds 2000 available products. Contact the administrator.",
    );
  const response = json({
    user: { id: actor.id, name: actor.name },
    products: catalog.products,
    sessions,
    settings: publicSettings(settings),
    shift: shift
      ? { id: shift.id, openedAt: shift.openedAt, drawer: shift.drawer }
      : null,
    savedAt: new Date().toISOString(),
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});

export const HEAD = handle(async () => {
  await requireAdmin("pos");
  return new Response(null, {
    headers: {
      "X-Cafe-Offline-Protocol": "1",
      "Cache-Control": "private, no-store",
    },
  });
});

const offlineSchema = z
  .object({
    requestId: z.string().uuid(),
    offline: z.literal(true),
    shiftId: z.string().min(1),
    accountId: z.string().min(1),
    expectedLineTotals: z
      .array(z.number().int().min(0).max(10000000))
      .min(1)
      .max(60),
    lines: z.array(cartLineSchema).min(1).max(60),
    expectedTotal: z.number().int().min(0).max(10000000),
    cashReceived: z.number().multipleOf(0.01).min(0).max(1000000),
    customerName: z.string().trim().min(2).max(60).default("Counter guest"),
    serviceMode: z
      .enum(["TAKEAWAY", "DINE_IN", "DELIVERY"])
      .default("TAKEAWAY"),
    sessionId: z.string().min(1).optional(),
    customerPhone: z.string().trim().max(30).optional(),
    addressLine: z.string().trim().max(200).optional(),
    city: z.string().trim().max(60).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.serviceMode === "DINE_IN" && !data.sessionId)
      ctx.addIssue({
        code: "custom",
        path: ["sessionId"],
        message: "Choose a prepared open table bill.",
      });
    if (data.serviceMode === "DELIVERY") {
      if (!data.customerPhone || !/^[+0-9 ()-]{7,30}$/.test(data.customerPhone))
        ctx.addIssue({
          code: "custom",
          path: ["customerPhone"],
          message: "Delivery needs a valid phone number.",
        });
      if (!data.addressLine || data.addressLine.length < 8)
        ctx.addIssue({
          code: "custom",
          path: ["addressLine"],
          message: "Delivery needs a complete address.",
        });
      if (!data.city || data.city.length < 2)
        ctx.addIssue({
          code: "custom",
          path: ["city"],
          message: "Delivery needs a city.",
        });
    }
  });
export const POST = handle(async (request: Request) => {
  const actor = await requireAdmin("pos");
  const data = await parseBody(request, offlineSchema);
  const order = await createCafeOrder(
    {
      requestId: data.requestId,
      expectedTotal: data.expectedTotal,
      lines: data.lines,
      customerName: data.customerName,
      customerPhone: data.serviceMode === "DELIVERY" ? data.customerPhone! : "",
      addressLine:
        data.serviceMode === "DELIVERY" ? data.addressLine : undefined,
      city: data.serviceMode === "DELIVERY" ? data.city : undefined,
      orderType: data.serviceMode === "DELIVERY" ? "DELIVERY" : "PICKUP",
      paymentMethod: "CASH_AT_COUNTER",
      saveAddress: false,
      redeemReward: false,
    },
    null,
    await getSettings(),
    {
      offline: true,
      expectedShiftId: data.shiftId,
      expectedLineTotals: data.expectedLineTotals,
      actor,
      cashReceived: data.cashReceived,
      accountId: data.accountId,
      ...(data.serviceMode === "DINE_IN"
        ? { sessionId: data.sessionId, serviceMode: "DINE_IN" }
        : {}),
    },
  );
  return json({ order: serializeOrder(order) }, 201);
});

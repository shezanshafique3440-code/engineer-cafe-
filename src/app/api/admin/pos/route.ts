import { z } from "zod";
import { cartLineSchema } from "@/lib/validation";
import { createCafeOrder } from "@/server/checkout";
import { serializeOrder } from "@/server/orders";
import { getSettings } from "@/server/settings";
import { handle, json, requireAdmin, parseBody, HttpError } from "@/server/api";
export const POST = handle(async (request: Request) => {
  const actor = await requireAdmin("pos");
  const data = await parseBody(
    request,
    z.object({
      requestId: z.string().uuid(),
      offline: z.boolean().default(false),
      shiftId: z.string().min(1).optional(),
      expectedTotal: z.number().int().min(0).max(10000000).optional(),
      lines: z.array(cartLineSchema).min(1).max(60),
      cashReceived: z.number().multipleOf(0.01).min(0).max(1000000),
      approvalId: z.string().optional(),
      accountId: z.string().optional(),
      credit: z.boolean().default(false),
      partyId: z.string().optional(),
      customerName: z.string().trim().min(2).max(60).default("Counter guest"),
      instructions: z.string().trim().max(300).default(""),
    }),
  );
  const { offline, shiftId, ...sale } = data;
  if (
    offline &&
    (!shiftId ||
      !sale.accountId ||
      sale.credit ||
      sale.partyId ||
      sale.approvalId)
  )
    throw new HttpError(
      400,
      "Offline bills require their original cash shift/account and do not support credit or approval discounts.",
    );
  const order = await createCafeOrder(
    {
      ...sale,
      customerPhone: "",
      orderType: "PICKUP",
      paymentMethod: "CASH_AT_COUNTER",
      saveAddress: false,
      redeemReward: false,
    },
    null,
    await getSettings(),
    {
      ...(offline ? { offline: true } : {}),
      ...(shiftId ? { expectedShiftId: shiftId } : {}),
      approvalId: data.approvalId,
      cashReceived: data.cashReceived,
      actor,
      accountId: data.accountId,
      credit: data.credit,
      partyId: data.partyId,
    },
  );
  return json({ order: serializeOrder(order) }, 201);
});

import { z } from "zod";
import { cartLineSchema } from "@/lib/validation";
import { createCafeOrder } from "@/server/checkout";
import { serializeOrder } from "@/server/orders";
import { getSettings } from "@/server/settings";
import { handle, json, requireAdmin, parseBody } from "@/server/api";
export const POST = handle(async (request: Request) => {
  const actor = await requireAdmin("pos");
  const data = await parseBody(
    request,
    z.object({
      requestId: z.string().uuid(),
      expectedTotal: z.number().int().min(0).max(10000000).optional(),
      lines: z.array(cartLineSchema).min(1).max(60),
      cashReceived: z.number().multipleOf(0.01).min(0).max(1000000),
      accountId: z.string().optional(),
      credit: z.boolean().default(false),
      partyId: z.string().optional(),
      customerName: z.string().trim().min(2).max(60).default("Counter guest"),
      instructions: z.string().trim().max(300).default(""),
    }),
  );
  const order = await createCafeOrder(
    {
      ...data,
      customerPhone: "",
      orderType: "PICKUP",
      paymentMethod: "CASH_AT_COUNTER",
      saveAddress: false,
      redeemReward: false,
    },
    null,
    await getSettings(),
    {
      cashReceived: data.cashReceived,
      actor,
      accountId: data.accountId,
      credit: data.credit,
      partyId: data.partyId,
    },
  );
  return json({ order: serializeOrder(order) }, 201);
});

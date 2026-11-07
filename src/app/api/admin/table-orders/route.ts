import { z } from "zod";
import { handle, json, requireAdmin, parseBody } from "@/server/api";
import { cartLineSchema } from "@/lib/validation";
import { createCafeOrder } from "@/server/checkout";
import { getSettings } from "@/server/settings";
import { serializeOrder } from "@/server/orders";
export const POST = handle(async (request: Request) => {
  const actor = await requireAdmin("table-orders");
  const d = await parseBody(
    request,
    z.object({
      requestId: z.string().uuid(),
      sessionId: z.string(),
      lines: z.array(cartLineSchema).min(1).max(60),
      customerName: z.string().trim().min(2).max(60).default("Table guest"),
      instructions: z.string().max(300).default(""),
      expectedTotal: z.number().int().optional(),
    }),
  );
  const order = await createCafeOrder(
    {
      ...d,
      orderType: "PICKUP",
      paymentMethod: "CASH_AT_COUNTER",
      customerPhone: "",
      saveAddress: false,
      redeemReward: false,
    },
    null,
    await getSettings(),
    { cashReceived: 0, actor, sessionId: d.sessionId, serviceMode: "DINE_IN" },
  );
  return json({ order: serializeOrder(order) }, 201);
});

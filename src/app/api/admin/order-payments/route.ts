import { z } from "zod";
import { handle, json, parseBody, HttpError } from "@/server/api";
import { businessActor, businessTx, hash } from "@/server/business/core";
import { receiveOrderMoney } from "@/server/business/order-ledger";
import { money, note } from "@/server/business/validation";
import { paise } from "@/lib/business-math";
import { consumeRefundApproval } from "@/server/business/operations";
export const POST = handle(async (request: Request) => {
  const actor = await businessActor("payments");
  const data = await parseBody(
    request,
    z.object({
      requestId: z.string().uuid(),
      orderId: z.string(),
      amount: money,
      accountId: z.string(),
      approvalId: z.string().optional(),
      refund: z.boolean().default(false),
      note,
    }),
  );
  const key = "order-payment:" + actor.id + ":" + data.requestId,
    payloadHash = hash(data);
  const order = await businessTx(async (tx) => {
    const previous = await tx.businessRequest.findUnique({ where: { key } });
    if (previous) {
      if (previous.payloadHash !== payloadHash)
        throw new HttpError(
          409,
          "This payment request was already used with different details.",
        );
      return previous.result;
    }
    if (data.refund) await consumeRefundApproval(tx, actor, data);
    const result = await receiveOrderMoney(tx, actor, {
      ...data,
      requestId: hash(key),
      amount: paise(data.amount),
    });
    const safe = JSON.parse(JSON.stringify(result));
    await tx.businessRequest.create({
      data: { key, payloadHash, result: safe },
    });
    return safe;
  });
  return json({ order });
});

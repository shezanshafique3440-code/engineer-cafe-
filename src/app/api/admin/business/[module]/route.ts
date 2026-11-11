import { readJsonBody } from "@/server/api";
import { handle, json, badRequest, HttpError } from "@/server/api";
import { businessActor, businessTx, businessReadTx, hash } from "@/server/business/core";
import { businessAction, MODULE_CAPS } from "@/server/business/actions";
import { businessRead } from "@/server/business/read";
import { schemas, type Module } from "@/server/business/validation";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ module: string }> };
export const GET = handle(async (request: Request, context: Context) => {
  const { module } = await context.params;
  if (!Object.hasOwn(MODULE_CAPS, module))
    throw badRequest("Unknown business module.");
  const actor = await businessActor(MODULE_CAPS[module]);
  return json(
    await businessReadTx((tx) =>
      businessRead(tx, actor, module, new URL(request.url)),
    ),
  );
});
export const POST = handle(async (request: Request, context: Context) => {
  const { module } = await context.params;
  if (!Object.hasOwn(schemas, module))
    throw badRequest("Unknown business action.");
  const actor = await businessActor(MODULE_CAPS[module]);
  let raw;
  try {
    raw = await readJsonBody(request);
  } catch {
    throw badRequest("Invalid request body.");
  }
  const valid = schemas[module as Module].parse(raw);
  const key = `${module}:${actor.id}:${valid.requestId}`,
    payloadHash = hash(valid);
  const result = await businessTx(async (tx) => {
    const prior = await tx.businessRequest.findUnique({ where: { key } });
    if (prior) {
      if (prior.payloadHash !== payloadHash)
        throw new HttpError(
          409,
          "This request was already used with different details. Refresh before retrying.",
        );
      return prior.result;
    }
    const h = hash(key);
    const scopedId = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
    const data = { ...valid, requestId: scopedId };
    const result = await businessAction(tx, actor, module as Module, data);
    const safe = JSON.parse(JSON.stringify(result ?? { ok: true }));
    await tx.businessRequest.create({
      data: { key, payloadHash, result: safe },
    });
    return safe;
  });
  return json({ result });
});

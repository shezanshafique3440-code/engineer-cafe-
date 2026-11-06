import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  handle,
  json,
  requireAdmin,
  parseBody,
  badRequest,
} from "@/server/api";
const endpoint = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      (u.hostname === "fcm.googleapis.com" ||
        u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname.endsWith(".push.services.mozilla.com") ||
        u.hostname === "web.push.apple.com" ||
        u.hostname.endsWith(".push.apple.com"))
    );
  }, "This push provider is unsupported.");
export const GET = handle(async () => {
  await requireAdmin();
  return json({
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
    configured: Boolean(
      process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
    ),
  });
});
export const POST = handle(async (request: Request) => {
  const user = await requireAdmin();
  if (!process.env.VAPID_PRIVATE_KEY)
    throw badRequest("Background alerts are not configured on the server yet.");
  const data = await parseBody(
    request,
    z.object({
      endpoint,
      keys: z.object({
        p256dh: z.string().regex(/^[\w-]{80,120}$/),
        auth: z.string().regex(/^[\w-]{20,30}$/),
      }),
    }),
  );
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    create: { userId: user.id, endpoint: data.endpoint, ...data.keys },
    update: { userId: user.id, ...data.keys },
  });
  return json({ id: sub.id });
});
export const DELETE = handle(async (request: Request) => {
  const user = await requireAdmin();
  const data = await parseBody(
    request,
    z.object({ endpoint: z.string().max(2048) }),
  );
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: data.endpoint, userId: user.id },
  });
  return json({ ok: true });
});

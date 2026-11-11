import { handle, json } from "@/server/api";
import { prisma } from "@/lib/prisma";
import { clearSessionCookie, getSession } from "@/server/auth";

export const POST = handle(async () => {
  const session = await getSession();
  if (session) await prisma.user.updateMany({ where: { id: session.id, sessionVersion: session.sessionVersion ?? 0 }, data: { sessionVersion: { increment: 1 } } });
  await clearSessionCookie();
  return json({ ok: true });
});

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json, parseBody, requireAdmin } from "@/server/api";

const schema = z.object({ status: z.enum(["NEW", "READ", "ARCHIVED"]) });

export const PATCH = handle(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const data = await parseBody(request, schema);
  const message = await prisma.contactMessage.update({ where: { id }, data: { status: data.status } });
  return json({ message });
});

export const DELETE = handle(async (_r: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  await prisma.contactMessage.delete({ where: { id } });
  return json({ ok: true });
});

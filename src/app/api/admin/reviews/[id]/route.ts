import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json, parseBody, requireAdmin } from "@/server/api";
import { refreshProductRating } from "@/server/products";

const schema = z.object({ status: z.enum(["PENDING", "APPROVED", "HIDDEN"]) });

export const PATCH = handle(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const data = await parseBody(request, schema);
  const review = await prisma.review.update({ where: { id }, data: { status: data.status } });
  await refreshProductRating(review.productId);
  return json({ review });
});

export const DELETE = handle(async (_r: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const review = await prisma.review.delete({ where: { id } });
  await refreshProductRating(review.productId);
  return json({ ok: true });
});

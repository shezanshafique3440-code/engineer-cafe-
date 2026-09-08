import { prisma } from "@/lib/prisma";
import { couponSchema } from "@/lib/validation";
import { handle, json, parseBody, requireAdmin } from "@/server/api";

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const PUT = handle(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const data = await parseBody(request, couponSchema);
  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      code: data.code,
      description: data.description || null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      minOrderAmount: data.minOrderAmount,
      maxDiscount: data.maxDiscount || null,
      maxUsage: data.maxUsage || null,
      perUserLimit: data.perUserLimit || null,
      startsAt: toDate(data.startsAt),
      expiresAt: toDate(data.expiresAt),
      isActive: data.isActive,
    },
  });
  return json({ coupon });
});

export const DELETE = handle(async (_r: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;

  const used = await prisma.order.count({ where: { couponId: id } });
  if (used > 0) {
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });
    return json({
      ok: true,
      message: "This coupon was used on past orders, so it was deactivated instead of deleted.",
    });
  }

  await prisma.coupon.delete({ where: { id } });
  return json({ ok: true, message: "Coupon deleted." });
});


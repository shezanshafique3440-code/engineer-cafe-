import { prisma } from "@/lib/prisma";
import { couponSchema } from "@/lib/validation";
import { handle, json, parseBody, requirePermission } from "@/server/api";

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const GET = handle(async () => {
  await requirePermission("promotions");
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return json({ coupons });
});

export const POST = handle(async (request: Request) => {
  await requirePermission("promotions");
  const data = await parseBody(request, couponSchema);
  const coupon = await prisma.coupon.create({
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
  return json({ coupon }, 201);
});

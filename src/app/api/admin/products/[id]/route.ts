import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { productSchema } from "@/lib/validation";
import { handle, json, parseBody, requireAdmin, notFound } from "@/server/api";

export const GET = handle(async (_r: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, addonGroups: { select: { addonGroupId: true } } },
  });
  if (!product) throw notFound("Product not found.");
  return json({
    product: { ...product, addonGroupIds: product.addonGroups.map((a) => a.addonGroupId) },
  });
});

export const PUT = handle(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const data = await parseBody(request, productSchema);
  const slug = slugify(data.slug || data.name);

  const product = await prisma.$transaction(async (tx) => {
    await tx.addonGroupOnProduct.deleteMany({ where: { productId: id } });
    return tx.product.update({
      where: { id },
      data: {
        name: data.name,
        slug,
        description: data.description,
        longDescription: data.longDescription || null,
        categoryId: data.categoryId,
        price: data.price,
        discountPrice: data.discountPrice || null,
        image: data.image || null,
        isAvailable: data.isAvailable,
        isFeatured: data.isFeatured,
        isPopular: data.isPopular,
        isVegetarian: data.isVegetarian,
        spiceLevel: data.spiceLevel,
        prepTimeMinutes: data.prepTimeMinutes,
        ingredients: data.ingredients,
        calories: data.calories ?? null,
        stock: data.stock ?? null,
        sortOrder: data.sortOrder,
        addonGroups: {
          create: data.addonGroupIds.map((addonGroupId, index) => ({ addonGroupId, sortOrder: index })),
        },
      },
      include: { category: true },
    });
  });

  return json({ product });
});

/**
 * Products referenced by past orders are archived (made unavailable) instead of
 * deleted, so order history stays intact.
 */
export const DELETE = handle(async (_r: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;

  const referenced = await prisma.orderItem.count({ where: { productId: id } });
  if (referenced > 0) {
    await prisma.product.update({ where: { id }, data: { isAvailable: false } });
    return json({
      ok: true,
      archived: true,
      message: "This item appears in past orders, so it was hidden from the menu instead of deleted.",
    });
  }

  await prisma.product.delete({ where: { id } });
  return json({ ok: true, archived: false, message: "Product deleted." });
});


import { audit, businessTx } from "@/server/business/core";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { productSchema } from "@/lib/validation";
import { handle, json, parseBody, requireAdmin, notFound } from "@/server/api";

export const GET = handle(
  async (_r: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireAdmin("catalog");
    const { id } = await ctx.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        addonGroups: { select: { addonGroupId: true } },
      },
    });
    if (!product) throw notFound("Product not found.");
    return json({
      product: {
        ...product,
        addonGroupIds: product.addonGroups.map((a) => a.addonGroupId),
      },
    });
  },
);

export const PUT = handle(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireAdmin("catalog");
    const { id } = await ctx.params;
    const data = await parseBody(request, productSchema);
    const slug = slugify(data.slug || data.name);

    const product = await businessTx(async (tx) => {
      const before = await tx.product.findUniqueOrThrow({ where: { id } });
      await tx.addonGroupOnProduct.deleteMany({ where: { productId: id } });
      const updated = await tx.product.update({
        where: { id },
        data: {
          name: data.name,
          urduName: data.urduName || null,
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
            create: data.addonGroupIds.map((addonGroupId, index) => ({
              addonGroupId,
              sortOrder: index,
            })),
          },
        },
        include: { category: true },
      });
      await audit(tx, actor, "UPDATE_PRODUCT", "Product", id, {
        before: {
          name: before.name,
          price: before.price,
          discountPrice: before.discountPrice,
          stock: before.stock,
          available: before.isAvailable,
        },
        after: {
          name: updated.name,
          price: updated.price,
          discountPrice: updated.discountPrice,
          stock: updated.stock,
          available: updated.isAvailable,
        },
      });
      return updated;
    });

    return json({ product });
  },
);

/**
 * Products referenced by past orders are archived (made unavailable) instead of
 * deleted, so order history stays intact.
 */
export const DELETE = handle(
  async (_r: Request, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireAdmin("catalog");
    const { id } = await ctx.params;
    const result = await businessTx(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({ where: { id } });
      const referenced = await tx.orderItem.count({ where: { productId: id } });
      if (referenced > 0)
        await tx.product.update({
          where: { id },
          data: { isAvailable: false },
        });
      else await tx.product.delete({ where: { id } });
      await audit(
        tx,
        actor,
        referenced ? "ARCHIVE_PRODUCT" : "DELETE_PRODUCT",
        "Product",
        id,
        { name: product.name, price: product.price, archived: referenced > 0 },
      );
      return {
        ok: true,
        archived: referenced > 0,
        message: referenced
          ? "This item appears in past orders, so it was hidden from the menu instead of deleted."
          : "Product deleted.",
      };
    });
    return json(result);
  },
);

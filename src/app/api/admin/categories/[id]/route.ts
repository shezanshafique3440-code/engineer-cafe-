import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { categorySchema } from "@/lib/validation";
import { handle, json, parseBody, requireAdmin, HttpError } from "@/server/api";

export const PUT = handle(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const data = await parseBody(request, categorySchema);
  const category = await prisma.category.update({
    where: { id },
    data: {
      name: data.name,
      slug: slugify(data.slug || data.name),
      description: data.description || null,
      image: data.image || null,
      icon: data.icon || null,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
  });
  return json({ category });
});

export const DELETE = handle(async (_r: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;

  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    throw new HttpError(
      409,
      `This category still has ${productCount} product${productCount === 1 ? "" : "s"}. Move or delete them first.`,
    );
  }

  await prisma.category.delete({ where: { id } });
  return json({ ok: true });
});

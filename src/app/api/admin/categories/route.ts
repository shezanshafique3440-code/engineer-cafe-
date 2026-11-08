import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { categorySchema } from "@/lib/validation";
import { handle, json, parseBody, requirePermission } from "@/server/api";

export const GET = handle(async () => {
  await requirePermission("catalogue");
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return json({
    categories: categories.map((c) => ({ ...c, productCount: c._count.products })),
  });
});

export const POST = handle(async (request: Request) => {
  await requirePermission("catalogue");
  const data = await parseBody(request, categorySchema);
  const category = await prisma.category.create({
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
  return json({ category }, 201);
});

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { productSchema } from "@/lib/validation";
import { handle, json, parseBody, parseQuery, requireAdmin } from "@/server/api";

const querySchema = z.object({
  search: z.string().max(80).optional(),
  category: z.string().max(60).optional(),
  status: z.enum(["all", "available", "unavailable"]).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handle(async (request: Request) => {
  await requireAdmin();
  const q = parseQuery(request, querySchema);

  const where = {
    ...(q.search
      ? { OR: [{ name: { contains: q.search, mode: "insensitive" as const } }, { slug: { contains: q.search, mode: "insensitive" as const } }] }
      : {}),
    ...(q.category ? { category: { slug: q.category } } : {}),
    ...(q.status === "available" ? { isAvailable: true } : {}),
    ...(q.status === "unavailable" ? { isAvailable: false } : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      skip: (q.page - 1) * q.perPage,
      take: q.perPage,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        addonGroups: { select: { addonGroupId: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return json({
    products: products.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      addonGroupIds: p.addonGroups.map((a) => a.addonGroupId),
    })),
    total,
    page: q.page,
    perPage: q.perPage,
    totalPages: Math.max(1, Math.ceil(total / q.perPage)),
  });
});

export const POST = handle(async (request: Request) => {
  await requireAdmin();
  const data = await parseBody(request, productSchema);
  const slug = slugify(data.slug || data.name);

  const product = await prisma.product.create({
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

  return json({ product }, 201);
});

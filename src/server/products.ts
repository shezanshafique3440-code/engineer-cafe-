import "server-only";
import type { Prisma, SpiceLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProductDTO, CategoryDTO } from "@/lib/types";

export type ProductSort = "popular" | "price-asc" | "price-desc" | "rating" | "newest" | "name";

export type ProductQuery = {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  vegetarian?: boolean;
  popular?: boolean;
  featured?: boolean;
  spicy?: boolean;
  minRating?: number;
  availableOnly?: boolean;
  sort?: ProductSort;
  page?: number;
  perPage?: number;
};

const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  longDescription: true,
  price: true,
  discountPrice: true,
  image: true,
  isAvailable: true,
  isFeatured: true,
  isPopular: true,
  isVegetarian: true,
  spiceLevel: true,
  prepTimeMinutes: true,
  ingredients: true,
  calories: true,
  stock: true,
  ratingAverage: true,
  ratingCount: true,
  soldCount: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

export function toProductDTO(product: ProductRow): ProductDTO {
  return {
    ...product,
    spiceLevel: product.spiceLevel as SpiceLevel,
    createdAt: product.createdAt.toISOString(),
  };
}

function orderBy(sort: ProductSort | undefined): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ price: "asc" }, { name: "asc" }];
    case "price-desc":
      return [{ price: "desc" }, { name: "asc" }];
    case "rating":
      return [{ ratingAverage: "desc" }, { ratingCount: "desc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "name":
      return [{ name: "asc" }];
    case "popular":
    default:
      return [{ isPopular: "desc" }, { soldCount: "desc" }, { ratingAverage: "desc" }, { sortOrder: "asc" }];
  }
}

export function buildWhere(query: ProductQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  const and: Prisma.ProductWhereInput[] = [];

  if (query.availableOnly !== false) and.push({ isAvailable: true });
  if (query.category) and.push({ category: { slug: query.category } });
  if (query.vegetarian) and.push({ isVegetarian: true });
  if (query.popular) and.push({ isPopular: true });
  if (query.featured) and.push({ isFeatured: true });
  if (query.spicy) and.push({ spiceLevel: { in: ["MILD", "MEDIUM", "HOT"] } });
  if (query.minRating) and.push({ ratingAverage: { gte: query.minRating } });
  if (query.minPrice != null) and.push({ price: { gte: query.minPrice } });
  if (query.maxPrice != null) and.push({ price: { lte: query.maxPrice } });

  const term = query.search?.trim();
  if (term) {
    // Match name, description, category or any ingredient — so "spicy",
    // "cheese" and "chicken" all return sensible results.
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { longDescription: { contains: term, mode: "insensitive" } },
        { ingredients: { has: term } },
        { ingredients: { hasSome: term.split(/\s+/).filter(Boolean) } },
        { category: { name: { contains: term, mode: "insensitive" } } },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
}

export async function listProducts(query: ProductQuery) {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(60, Math.max(1, query.perPage ?? 24));
  const where = buildWhere(query);

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: productSelect,
      orderBy: orderBy(query.sort),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: rows.map(toProductDTO),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getProductBySlug(slug: string): Promise<ProductDTO | null> {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      ...productSelect,
      addonGroups: {
        orderBy: { sortOrder: "asc" },
        select: {
          addonGroup: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
              isRequired: true,
              minSelect: true,
              maxSelect: true,
              addons: {
                where: { isAvailable: true },
                orderBy: { sortOrder: "asc" },
                select: { id: true, name: true, price: true, isDefault: true, isAvailable: true },
              },
            },
          },
        },
      },
    },
  });
  if (!product) return null;

  const comboItems = await prisma.comboItem.findMany({
    where: { comboId: product.id },
    include: { product: { select: { name: true } } },
  });

  const { addonGroups, ...rest } = product;
  return {
    ...toProductDTO(rest),
    addonGroups: addonGroups.map((link) => link.addonGroup),
    comboItems: comboItems.map((c) => ({ productName: c.product.name, quantity: c.quantity })),
  };
}

export async function listCategories(includeInactive = false): Promise<CategoryDTO[]> {
  const categories = await prisma.category.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: { where: { isAvailable: true } } } },
    },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    icon: c.icon,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    productCount: c._count.products,
  }));
}

/** Recomputes a product's rating aggregates from its approved reviews. */
export async function refreshProductRating(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAverage: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      ratingCount: agg._count.rating,
    },
  });
}

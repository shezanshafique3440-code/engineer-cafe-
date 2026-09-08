import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json, parseBody, requireUser } from "@/server/api";
import { toProductDTO } from "@/server/products";

const schema = z.object({ productId: z.string().min(1) });

export const GET = handle(async () => {
  const user = await requireUser();
  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true, name: true, slug: true, description: true, longDescription: true,
          price: true, discountPrice: true, image: true, isAvailable: true, isFeatured: true,
          isPopular: true, isVegetarian: true, spiceLevel: true, prepTimeMinutes: true,
          ingredients: true, calories: true, stock: true, ratingAverage: true,
          ratingCount: true, soldCount: true, createdAt: true,
          category: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
  return json({
    products: favorites.map((f) => toProductDTO(f.product)),
    productIds: favorites.map((f) => f.productId),
  });
});

/** Toggles a favorite and returns the new state. */
export const POST = handle(async (request: Request) => {
  const user = await requireUser();
  const { productId } = await parseBody(request, schema);

  const existing = await prisma.favorite.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return json({ favorited: false });
  }

  await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { id: true } });
  await prisma.favorite.create({ data: { userId: user.id, productId } });
  return json({ favorited: true }, 201);
});

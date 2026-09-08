import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { toProductDTO } from "@/server/products";
import { buildMetadata } from "@/lib/seo";
import { FavoritesView } from "@/components/account/favorites-view";

export const metadata: Metadata = buildMetadata({
  title: "My Favorites",
  path: "/account/favorites",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true, name: true, slug: true, description: true, longDescription: true,
          price: true, discountPrice: true, image: true, isAvailable: true, isFeatured: true,
          isPopular: true, isVegetarian: true, spiceLevel: true, prepTimeMinutes: true,
          ingredients: true, calories: true, stock: true, ratingAverage: true, ratingCount: true,
          soldCount: true, createdAt: true,
          category: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  return <FavoritesView initialProducts={favorites.map((f) => toProductDTO(f.product))} />;
}

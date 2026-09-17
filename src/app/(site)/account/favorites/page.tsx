import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { productSelect, toProductDTO } from "@/server/products";
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
    include: { product: { select: productSelect } },
  });

  return <FavoritesView initialProducts={favorites.map((f) => toProductDTO(f.product))} />;
}

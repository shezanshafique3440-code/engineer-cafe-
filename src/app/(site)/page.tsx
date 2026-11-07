import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { listCategories, listProducts } from "@/server/products";
import { getSettings } from "@/server/settings";
import { buildMetadata, restaurantJsonLd, SITE_DESCRIPTION } from "@/lib/seo";
import { RecentlyViewed } from "@/components/storefront/browse-memory";
import { Hero } from "@/components/home/hero";
import {
  CafeCollections,
  CafeStory,
  SignatureMenu,
  CafeVisit,
  CafeReviews,
  CafeConcierge,
} from "@/components/home/cinematic-sections";

export const metadata: Metadata = buildMetadata({
  title: "Engineer Cafe | Chai & Paratha",
  description: SITE_DESCRIPTION,
  path: "/",
});
export const revalidate = 60;

export default async function HomePage() {
  const [catalog, categories, settings, stats, ratings, reviews] =
    await Promise.all([
      listProducts({ perPage: 60, sort: "popular" }),
      listCategories(),
      getSettings(),
      prisma.product.aggregate({
        where: {
          isAvailable: true,
          category: { isActive: true },
          OR: [{ stock: null }, { stock: { gt: 0 } }],
        },
        _avg: { prepTimeMinutes: true },
        _count: true,
      }),
      prisma.review.aggregate({
        where: {
          status: "APPROVED",
          product: { isAvailable: true, category: { isActive: true } },
        },
        _avg: { rating: true },
        _count: true,
      }),
      prisma.review.findMany({
        where: {
          status: "APPROVED",
          rating: { gte: 4 },
          product: { isAvailable: true, category: { isActive: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          rating: true,
          comment: true,
          user: { select: { name: true } },
          product: { select: { name: true } },
        },
      }),
    ]);
  const available = catalog.products.filter(
    (p) =>
      p.isAvailable &&
      p.stock !== 0 &&
      categories.some((c) => c.id === p.category.id),
  );
  const featured=available.filter(p=>p.isFeatured);
  const highlights=featured.length?featured:available.slice(0,1);

  return (
    <div className="cinema-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(restaurantJsonLd(settings)).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
      <Hero stats={{highlights,avgPrepMinutes:Math.max(1,Math.round(stats._avg.prepTimeMinutes??10)),menuItems:stats._count,rating:ratings._count?ratings._avg.rating:null}}/>
      <CafeCollections products={available} />
      <CafeStory products={available} />
      <SignatureMenu products={available} categories={categories} />
      <CafeVisit />
      <CafeReviews
        reviews={reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          author: r.user.name,
          productName: r.product.name,
        }))}
      />
      <CafeConcierge />
      <RecentlyViewed />
    </div>
  );
}

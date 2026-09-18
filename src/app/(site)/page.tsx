import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { listCategories, listProducts } from "@/server/products";
import { getSettings } from "@/server/settings";
import { buildMetadata, restaurantJsonLd, SITE_DESCRIPTION } from "@/lib/seo";
import { Hero } from "@/components/home/hero";
import {
  PopularCategories, ProductRail, EngineerDeals, WhyEngineerCafe,
  CustomerReviews, CafeExperience, SocialSection, LocationSection, FinalCta,
} from "@/components/home/sections";

export const metadata: Metadata = buildMetadata({
  title: "Engineer Cafe | Chai & Paratha",
  description: SITE_DESCRIPTION,
  path: "/",
});

// The homepage is fully database-driven; revalidate so menu edits appear fast.
export const revalidate = 60;

/** Most featured dishes the hero will rotate through. */
const HERO_HIGHLIGHT_LIMIT = 6;

export default async function HomePage() {
  const [categories, chai, parathas, deals, reviews, settings, heroAgg, featured, bestSeller] =
    await Promise.all([
    listCategories(),
    listProducts({ category: "chai", popular: true, perPage: 4, sort: "popular" }),
    listProducts({ category: "parathas", popular: true, perPage: 4, sort: "popular" }),
    listProducts({ category: "combos", perPage: 6, sort: "popular" }),
    prisma.review.findMany({
      // Only for items still on the menu — a review for a withdrawn dish is
      // noise at best and misleading at worst.
      where: { status: "APPROVED", rating: { gte: 4 }, product: { isAvailable: true } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true, rating: true, comment: true,
        user: { select: { name: true } },
        product: { select: { name: true } },
      },
    }),
    getSettings(),
    prisma.product.aggregate({
      where: { isAvailable: true },
      _avg: { prepTimeMinutes: true, ratingAverage: true },
      _count: true,
      _sum: { ratingCount: true },
    }),
    // Everything the cafe marks Featured in admin takes a turn in the hero,
    // best seller first. Capped so a cafe that features half the menu does not
    // push a dozen photographs into the first paint.
    prisma.product.findMany({
      where: { isAvailable: true, isFeatured: true },
      orderBy: [{ soldCount: "desc" }, { ratingAverage: "desc" }],
      take: HERO_HIGHLIGHT_LIMIT,
      select: {
        name: true, urduName: true, slug: true, image: true,
        price: true, discountPrice: true, isFeatured: true,
        category: { select: { slug: true } },
      },
    }),
    // Fallback for a menu with nothing featured: the genuine best seller.
    prisma.product.findFirst({
      where: { isAvailable: true },
      orderBy: [{ soldCount: "desc" }, { ratingAverage: "desc" }],
      select: {
        name: true, urduName: true, slug: true, image: true,
        price: true, discountPrice: true, isFeatured: true,
        category: { select: { slug: true } },
      },
    }),
  ]);

  const ratedCount = heroAgg._sum.ratingCount ?? 0;
  const heroStats = {
    avgPrepMinutes: Math.max(1, Math.round(heroAgg._avg.prepTimeMinutes ?? 10)),
    menuItems: heroAgg._count,
    rating: ratedCount > 0 ? Number((heroAgg._avg.ratingAverage ?? 0).toFixed(1)) : null,
    highlights: featured.length > 0 ? featured : bestSeller ? [bestSeller] : [],
  };

  const jsonLd = restaurantJsonLd(settings);

  return (
    <>
      <script
        type="application/ld+json"
        // Structured data for search engines — generated server-side from settings.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Hero stats={heroStats} />

      <PopularCategories categories={categories} />

      <ProductRail
        eyebrow="// best selling chai"
        title="The cups that keep this place running."
        description="Brewed to order — set your sugar, milk and strength before it hits the tawa-side counter."
        products={chai.products}
        href="/menu/chai"
        tone="white"
      />

      <ProductRail
        eyebrow="// popular parathas"
        title="Straight off the tawa."
        description="Hand-rolled through the day. Add cheese, egg or chicken to any of them."
        products={parathas.products}
        href="/menu/parathas"
      />

      <EngineerDeals deals={deals.products} />

      <WhyEngineerCafe />

      <CustomerReviews
        reviews={reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          author: r.user.name,
          productName: r.product.name,
        }))}
      />

      <CafeExperience />

      <SocialSection />

      <LocationSection />

      <FinalCta />
    </>
  );
}

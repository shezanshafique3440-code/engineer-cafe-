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

export default async function HomePage() {
  const [categories, chai, parathas, deals, reviews, settings] = await Promise.all([
    listCategories(),
    listProducts({ category: "chai", popular: true, perPage: 4, sort: "popular" }),
    listProducts({ category: "parathas", popular: true, perPage: 4, sort: "popular" }),
    listProducts({ category: "combos", perPage: 6, sort: "popular" }),
    prisma.review.findMany({
      where: { status: "APPROVED", rating: { gte: 4 } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true, rating: true, comment: true,
        user: { select: { name: true } },
        product: { select: { name: true } },
      },
    }),
    getSettings(),
  ]);

  const jsonLd = restaurantJsonLd(settings);

  return (
    <>
      <script
        type="application/ld+json"
        // Structured data for search engines — generated server-side from settings.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Hero />

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

import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { listCategories } from "@/server/products";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { MenuBrowser } from "@/components/menu/menu-browser";
import { ProductCardSkeleton } from "@/components/menu/product-card";

export const metadata: Metadata = buildMetadata({
  title: "Full Menu — Chai, Parathas, Snacks & Combos",
  description:
    "Browse the complete Engineer Cafe menu: 20+ kinds of chai, stuffed parathas, snacks, burgers, cold drinks and student combos. Order online in Lahore.",
  path: "/menu",
});

export const revalidate = 60;

export default async function MenuPage() {
  const categories = await listCategories();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Menu", path: "/menu" },
            ]),
          ),
        }}
      />

      <div className="border-b border-cream-200 bg-cream-100">
        <div className="container py-10 md:py-14">
          <p className="eyebrow">{"// the full menu"}</p>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Compile your cravings.</h1>
          <p className="mt-3 max-w-2xl text-sm text-charcoal-600 md:text-base">
            Everything we serve, priced in rupees and updated live from the kitchen. Filter by
            category, price or spice, then customise before it goes in your cart.
          </p>

          <nav aria-label="Menu categories" className="no-scrollbar mt-7 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/menu/${category.slug}`}
                className="shrink-0 rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-medium text-charcoal-700 transition hover:border-chai-400 hover:text-chai-700"
              >
                <span aria-hidden>{category.icon}</span> {category.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="container py-8 md:py-10">
        <Suspense
          fallback={
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          }
        >
          <MenuBrowser categories={categories} />
        </Suspense>
      </div>
    </>
  );
}

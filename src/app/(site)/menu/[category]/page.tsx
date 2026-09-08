import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listCategories } from "@/server/products";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { MenuBrowser } from "@/components/menu/menu-browser";
import { ProductCardSkeleton } from "@/components/menu/product-card";

export const revalidate = 60;

export async function generateStaticParams() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) return buildMetadata({ title: "Category not found", path: `/menu/${slug}`, noIndex: true });

  return buildMetadata({
    title: `${category.name} Menu`,
    description:
      category.description ??
      `Order ${category.name.toLowerCase()} from Engineer Cafe — fresh, affordable and delivered across Lahore.`,
    path: `/menu/${category.slug}`,
    image: category.image,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const [category, categories] = await Promise.all([
    prisma.category.findUnique({
      where: { slug },
      include: { _count: { select: { products: { where: { isAvailable: true } } } } },
    }),
    listCategories(),
  ]);

  if (!category || !category.isActive) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Menu", path: "/menu" },
              { name: category.name, path: `/menu/${category.slug}` },
            ]),
          ),
        }}
      />

      <div className="border-b border-cream-200 bg-cream-100">
        <div className="container py-10 md:py-14">
          <nav aria-label="Breadcrumb" className="mb-4 text-xs text-charcoal-500">
            <Link href="/" className="hover:text-chai-700">Home</Link>
            <span className="mx-1.5" aria-hidden>/</span>
            <Link href="/menu" className="hover:text-chai-700">Menu</Link>
            <span className="mx-1.5" aria-hidden>/</span>
            <span className="text-charcoal-800">{category.name}</span>
          </nav>

          <span className="text-3xl" aria-hidden>{category.icon}</span>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">{category.name}</h1>
          {category.description && (
            <p className="mt-3 max-w-2xl text-sm text-charcoal-600 md:text-base">
              {category.description}
            </p>
          )}
          <p className="mt-2 text-xs text-charcoal-400">
            {category._count.products} item{category._count.products === 1 ? "" : "s"} available
          </p>
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
          <MenuBrowser categories={categories} lockedCategory={category.slug} />
        </Suspense>
      </div>
    </>
  );
}

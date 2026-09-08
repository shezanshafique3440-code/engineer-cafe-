import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProductBySlug, listProducts } from "@/server/products";
import { buildMetadata, breadcrumbJsonLd, absoluteUrl } from "@/lib/seo";
import { ProductDetail } from "@/components/menu/product-detail";
import { ProductCard } from "@/components/menu/product-card";
import { SectionHeading } from "@/components/ui";

export const revalidate = 60;

export async function generateStaticParams() {
  const products = await prisma.product.findMany({
    where: { isAvailable: true },
    select: { slug: true, category: { select: { slug: true } } },
    take: 100,
  });
  return products.map((p) => ({ category: p.category.slug, slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return buildMetadata({ title: "Item not found", path: `/menu/${category}/${slug}`, noIndex: true });
  }

  return buildMetadata({
    title: product.name,
    description: product.description,
    path: `/menu/${product.category.slug}/${product.slug}`,
    image: product.image,
    type: "article",
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [reviewRows, related] = await Promise.all([
    prisma.review.findMany({
      where: { productId: product.id, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, rating: true, comment: true, createdAt: true, user: { select: { name: true } } },
    }),
    listProducts({ category: product.category.slug, perPage: 5, sort: "popular" }),
  ]);

  const reviews = reviewRows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    author: r.user.name,
  }));

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.image ? [product.image] : undefined,
    category: product.category.name,
    offers: {
      "@type": "Offer",
      price: product.discountPrice ?? product.price,
      priceCurrency: "PKR",
      availability: product.isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: absoluteUrl(`/menu/${product.category.slug}/${product.slug}`),
    },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAverage,
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };

  const relatedProducts = related.products.filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Menu", path: "/menu" },
              { name: product.category.name, path: `/menu/${product.category.slug}` },
              { name: product.name, path: `/menu/${product.category.slug}/${product.slug}` },
            ]),
          ),
        }}
      />

      <div className="border-b border-cream-200 bg-cream-100">
        <div className="container py-4">
          <nav aria-label="Breadcrumb" className="text-xs text-charcoal-500">
            <Link href="/" className="hover:text-chai-700">Home</Link>
            <span className="mx-1.5" aria-hidden>/</span>
            <Link href="/menu" className="hover:text-chai-700">Menu</Link>
            <span className="mx-1.5" aria-hidden>/</span>
            <Link href={`/menu/${product.category.slug}`} className="hover:text-chai-700">
              {product.category.name}
            </Link>
            <span className="mx-1.5" aria-hidden>/</span>
            <span className="text-charcoal-800">{product.name}</span>
          </nav>
        </div>
      </div>

      <ProductDetail product={product} reviews={reviews} />

      {relatedProducts.length > 0 && (
        <section className="bg-white py-12 md:py-16">
          <div className="container">
            <SectionHeading
              eyebrow="// goes well with"
              title={`More ${product.category.name}`}
            />
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {relatedProducts.map((item, index) => (
                <ProductCard key={item.id} product={item} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

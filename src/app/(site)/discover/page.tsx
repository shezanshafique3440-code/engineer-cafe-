import type { Metadata } from "next";
import { getMealCatalog } from "@/server/products";
import { MoodDiscovery } from "@/components/storefront/discovery";
export const metadata: Metadata = {
  title: "Discover your next favourite",
  description:
    "Explore chai, parathas and cafe favourites by taste, mood and value.",
};
export const dynamic = "force-dynamic";
export default async function DiscoverPage() {
  const { products, truncated } = await getMealCatalog();
  return (
    <>
      <MoodDiscovery products={products} full />
      {truncated && (
        <p className="container pb-5 text-xs text-charcoal-500">
          Showing discovery picks from the first 200 available products.
        </p>
      )}
    </>
  );
}

"use client";
import { T } from "@/context/language-context";
import { useEffect } from "react";
import { History } from "lucide-react";
import { useStorefront } from "@/context/storefront-context";
import { useSelection } from "./use-selection";
import { ProductCard } from "@/components/menu/product-card";
import { Button } from "@/components/ui";
export function RememberProduct({ slug }: { slug: string }) {
  const { record, ready } = useStorefront();
  useEffect(() => {
    if (ready) record(slug);
  }, [slug, record, ready]);
  return null;
}
export function RecentlyViewed() {
  const { history, clearHistory, ready } = useStorefront();
  const { products, loading, error, retry } = useSelection(
    history.map((p) => p.slug),
  );
  if (!ready || !history.length) return null;
  return (
    <section className="section border-t border-cream-200 bg-cream-100/50">
      <div className="container">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <History className="h-3.5 w-3.5" />
              {<T text="Your browsing trail"/>}</p>
            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
              {<T text="Still on your mind?"/>}</h2>
            <p className="mt-2 text-sm text-charcoal-500">
              {<T text="Recently viewed on this browser, with current menu prices."/>}</p>
          </div>
          <Button variant="ghost" onClick={clearHistory}>
            {<T text="Clear history"/>}</Button>
        </div>
        {error ? (
          <div role="status">
            <p className="mb-3 text-sm">{<T text="Your recent items could not refresh."/>}</p>
            <Button variant="secondary" onClick={retry}>
              {<T text="Try again"/>}</Button>
          </div>
        ) : loading ? (
          <p role="status" className="py-8 text-sm text-charcoal-500">
            {<T text="Refreshing your browsing trail…"/>}</p>
        ) : !products.length ? (
          <p className="py-6 text-sm text-charcoal-500">
            {<T text="These dishes are no longer available. Discover something new on the menu."/>}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-charcoal-400">
          {<T text="Only product identifiers are saved locally for 14 days. Clear them whenever you like."/>}</p>
      </div>
    </section>
  );
}

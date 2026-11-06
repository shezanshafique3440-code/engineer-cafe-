"use client";
import { T } from "@/context/language-context";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { pairingProducts } from "@/lib/storefront";
import { basePrice } from "@/lib/menu-planner";
import { useCart } from "@/context/cart-context";
import { useMoney } from "@/context/settings-context";
import { ProductDialog } from "@/components/menu/product-dialog";
import { Button } from "@/components/ui";
import type { ProductDTO } from "@/lib/types";
export function PairingSuggestions({
  productId,
  category,
}: {
  productId?: string;
  category?: string;
}) {
  const { lines, addItem } = useCart();
  const money = useMoney();
  const [catalog, setCatalog] = useState<ProductDTO[]>([]),
    [customise, setCustomise] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    apiGet<{ products: ProductDTO[] }>("/api/meal-catalog")
      .then((d) => {
        if (active) setCatalog(d.products);
      })
      .catch(() => {
        /* Optional recommendations must never block ordering. */
      });
    return () => {
      active = false;
    };
  }, []);
  const ids = [
    ...lines.map((l) => l.productId),
    ...(productId ? [productId] : []),
  ];
  const categories = [
    ...lines.flatMap((l) => (l.categorySlug ? [l.categorySlug] : [])),
    ...(category ? [category] : []),
  ];
  const products = pairingProducts(catalog, ids, categories);
  if (!products.length) return null;
  return (
    <section className="mt-8 border-t border-cream-200 pt-7">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{<T text="The perfect company"/>}</p>
          <h2 className="mt-2 text-xl font-bold">
            {<T text="Good on its own. Better together."/>}</h2>
        </div>
        <Link
          href="/meal-finder"
          className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-chai-700"
        >
          {<T text="Plan a meal"/>}<ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {products.map((p) => (
          <article key={p.id} className="surface flex min-w-0 flex-col p-3">
            <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-cream-100">
              {p.image && (
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  sizes="(max-width:640px) 100vw,25vw"
                  className="object-cover"
                />
              )}
            </div>
            <h3 className="text-sm font-bold">{<T text={p.name}/> }</h3>
            <p className="mb-3 mt-1 text-xs text-charcoal-500">
              {p.hasOptions ? "From " : ""}
              {money(basePrice(p))} · {p.prepTimeMinutes} {<T text="min prep"/>}</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-auto w-full"
              onClick={() => (p.hasOptions ? setCustomise(p.slug) : addItem(p))}
            >
              <Plus className="h-3.5 w-3.5" />
              {p.hasOptions ? "Choose options" : "Add pairing"}
            </Button>
          </article>
        ))}
      </div>
      {customise && (
        <ProductDialog
          slug={customise}
          open
          onClose={() => setCustomise(null)}
        />
      )}
    </section>
  );
}

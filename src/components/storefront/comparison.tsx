"use client";
import { T } from "@/context/language-context";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { GitCompareArrows, X } from "lucide-react";
import { useStorefront } from "@/context/storefront-context";
import { useSelection } from "./use-selection";
import { useMoney } from "@/context/settings-context";
import { useCart } from "@/context/cart-context";
import { ProductDialog } from "@/components/menu/product-dialog";
import { Button } from "@/components/ui";
import { basePrice } from "@/lib/menu-planner";
import { SPICE_LABEL } from "@/lib/constants";
export function ProductComparison() {
  const { compared, toggleCompare, clearCompare, ready } = useStorefront();
  const { products, loading, error, retry } = useSelection(compared);
  const money = useMoney();
  const { addItem } = useCart();
  const [customise, setCustomise] = useState<string | null>(null);
  return (
    <div className="container py-10 md:py-16">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{<T text="The delicious details"/>}</p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-5xl">
            {<T text="Choose with confidence."/>}</h1>
          <p className="mt-4 max-w-xl text-sm text-charcoal-500">
            {<T text="Compare up to three dishes, side by side. Prices and availability are refreshed from the menu."/>}</p>
        </div>
        {!!compared.length && (
          <Button variant="ghost" onClick={clearCompare}>
            {<T text="Clear shortlist"/>}</Button>
        )}
      </div>
      {!ready || loading ? (
        <p role="status" className="py-14 text-center">
          {<T text="Refreshing your shortlist…"/>}</p>
      ) : error ? (
        <div className="surface p-8">
          <p>{<T text="Comparison could not load."/>}</p>
          <Button onClick={retry} className="mt-4">
            {<T text="Try again"/>}</Button>
        </div>
      ) : !compared.length ? (
        <div className="surface p-10 text-center">
          <GitCompareArrows className="mx-auto h-8 w-8 text-chai-500" />
          <h2 className="mt-4 text-xl font-bold">
            {<T text="Your shortlist starts with a craving."/>}</h2>
          <p className="mt-2 text-sm text-charcoal-500">
            {<T text="Tap Compare on any dish to add it here."/>}</p>
          <Link className="btn-primary mt-5" href="/discover">
            {<T text="Find something delicious"/>}</Link>
        </div>
      ) : (
        <>
          {products.length < compared.length && (
            <p
              role="status"
              className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
            >
              {<T text="Some shortlisted dishes are no longer available. Clear your shortlist to start fresh."/>}</p>
          )}
          <div className="grid items-start gap-5 md:grid-cols-3">
            {products.map((product) => (
              <article
                className="surface min-w-0 overflow-hidden"
                key={product.id}
              >
                <div className="relative aspect-[4/3] bg-cream-100">
                  {product.image && (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width:768px) 100vw,33vw"
                      className="object-cover"
                    />
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${product.name} from comparison`}
                    className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-soft"
                    onClick={() => toggleCompare(product.slug)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-5">
                  <p className="eyebrow">{<T text={product.category.name}/> }</p>
                  <h2 className="mt-2 text-xl font-bold">{<T text={product.name}/> }</h2>
                  <p className="mt-2 min-h-10 text-sm text-charcoal-500">
                    {<T text={product.description}/> }
                  </p>
                  <p className="my-5 text-2xl font-extrabold text-chai-700">
                    {money(basePrice(product))}
                    {product.hasOptions && (
                      <span className="ml-1 text-xs font-normal text-charcoal-500">
                        {<T text="base price"/>}</span>
                    )}
                  </p>
                  <dl className="divide-y divide-cream-200 text-sm">
                    {[
                      [
                        "Preparation",
                        `${product.prepTimeMinutes} min estimate`,
                      ],
                      ["Spice", SPICE_LABEL[product.spiceLevel]],
                      ["Vegetarian", product.isVegetarian ? "Yes" : "No"],
                      [
                        "Calories",
                        product.calories !== null
                          ? `${product.calories} kcal`
                          : "Not provided",
                      ],
                      [
                        "Rating",
                        product.ratingCount
                          ? `${product.ratingAverage.toFixed(1)} / 5 (${product.ratingCount} reviews)`
                          : "Not reviewed yet",
                      ],
                      [
                        "Availability",
                        product.stock === 0 ? "Sold out" : "Available",
                      ],
                    ].map(([label, value]) => (
                      <div
                        className="flex justify-between gap-3 py-3"
                        key={label}
                      >
                        <dt className="text-charcoal-500">{<T text={label}/> }</dt>
                        <dd className="text-right font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <Button
                    className="mt-5 w-full"
                    disabled={product.stock === 0}
                    onClick={() =>
                      product.hasOptions
                        ? setCustomise(product.slug)
                        : addItem(product)
                    }
                  >
                    {product.hasOptions ? "Choose options" : "Add to cart"}
                  </Button>
                  <Link
                    className="btn-ghost mt-2 w-full"
                    href={`/menu/${product.category.slug}/${product.slug}`}
                  >
                    {<T text="View full details"/>}</Link>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-5 text-xs text-charcoal-500">
            {<T text="Dietary labels and calorie estimates are provided by the cafe. Ask staff about allergens. Preparation excludes delivery time."/>}</p>
        </>
      )}
      {customise && (
        <ProductDialog
          open
          slug={customise}
          onClose={() => setCustomise(null)}
        />
      )}
    </div>
  );
}

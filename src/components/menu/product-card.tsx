"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Plus, Clock, Flame, Leaf, Check } from "lucide-react";
import { Badge, Rating } from "@/components/ui";
import { useCart } from "@/context/cart-context";
import { useFavorites } from "@/context/favorites-context";
import { useMoney } from "@/context/settings-context";
import { cn, discountPercent } from "@/lib/utils";
import type { ProductDTO } from "@/lib/types";
import { ProductDialog } from "./product-dialog";

export function ProductCard({
  product,
  index = 0,
  priority = false,
}: {
  product: ProductDTO;
  index?: number;
  priority?: boolean;
}) {
  const { addItem } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const money = useMoney();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [added, setAdded] = useState(false);

  const price = product.discountPrice ?? product.price;
  const saving = discountPercent(product.price, product.discountPrice);
  const favorited = isFavorite(product.id);
  const href = `/menu/${product.category.slug}/${product.slug}`;

  // Items with options open the customiser; simple items go straight in.
  const quickAdd = () => {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.24), ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft transition-shadow duration-300 hover:shadow-lift",
          !product.isAvailable && "opacity-70",
        )}
      >
        <div className="relative">
          <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-cream-200">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                priority={priority}
                loading={priority ? undefined : "lazy"}
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl" aria-hidden>☕</div>
            )}

            <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-start gap-1.5">
              {product.isPopular && <Badge tone="dark">🔥 Popular</Badge>}
              {saving && <Badge tone="red">-{saving}%</Badge>}
              {product.isVegetarian && (
                <Badge tone="green" className="ml-auto">
                  <Leaf className="h-3 w-3" aria-hidden />
                  <span className="sr-only">Vegetarian</span>
                </Badge>
              )}
            </div>

            {!product.isAvailable && (
              <div className="absolute inset-0 flex items-center justify-center bg-charcoal-900/55">
                <span className="rounded-lg bg-cream-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-charcoal-800">
                  Sold out
                </span>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={() => void toggle(product.id, product.name)}
            aria-label={favorited ? `Remove ${product.name} from favorites` : `Save ${product.name} to favorites`}
            aria-pressed={favorited}
            className="absolute -bottom-4 right-3 z-10 rounded-full bg-white p-2.5 shadow-lift transition hover:scale-110 active:scale-95"
          >
            <Heart className={cn("h-4 w-4", favorited ? "fill-chilli-500 text-chilli-500" : "text-charcoal-400")} />
          </button>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <Link href={href} className="min-w-0">
              <h3 className="truncate text-[15px] font-bold leading-snug text-charcoal-900 transition-colors group-hover:text-chai-700">
                {product.name}
              </h3>
            </Link>
            {product.spiceLevel !== "NONE" && (
              <Flame
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0",
                  product.spiceLevel === "HOT" ? "text-chilli-500" : "text-chai-400",
                )}
                aria-label={`Spice level: ${product.spiceLevel.toLowerCase()}`}
              />
            )}
          </div>

          <p className="line-clamp-2 min-h-[2.4rem] text-[13px] leading-snug text-charcoal-500">
            {product.description}
          </p>

          <div className="mt-2.5 flex items-center gap-3">
            <Rating value={product.ratingAverage} count={product.ratingCount} size={12} />
            <span className="inline-flex items-center gap-1 text-[11px] text-charcoal-400">
              <Clock className="h-3 w-3" aria-hidden />
              {product.prepTimeMinutes}m
            </span>
          </div>

          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
            <div className="min-w-0">
              <span className="block text-lg font-extrabold leading-none text-charcoal-900">
                {money(price)}
              </span>
              {product.discountPrice && (
                <span className="text-xs text-charcoal-300 line-through">{money(product.price)}</span>
              )}
            </div>

            <button
              type="button"
              disabled={!product.isAvailable}
              onClick={() => (product.category.slug === "chai" || product.category.slug === "parathas" || product.category.slug === "snacks" ? setDialogOpen(true) : quickAdd())}
              aria-label={`Add ${product.name} to cart`}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all active:scale-95",
                added
                  ? "bg-circuit-500 text-white"
                  : "bg-charcoal-900 text-cream-50 hover:bg-chai-600",
                !product.isAvailable && "cursor-not-allowed opacity-50 hover:bg-charcoal-900",
              )}
            >
              {added ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
              <span className="hidden sm:inline">{added ? "Added" : "Add"}</span>
            </button>
          </div>
        </div>
      </motion.article>

      {dialogOpen && (
        <ProductDialog slug={product.slug} open={dialogOpen} onClose={() => setDialogOpen(false)} />
      )}
    </>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-cream-200 bg-white">
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-2/3" />
        <div className="flex items-center justify-between pt-3">
          <div className="skeleton h-6 w-20" />
          <div className="skeleton h-9 w-16 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

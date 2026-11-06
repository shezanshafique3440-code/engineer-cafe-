"use client";
import { T } from "@/context/language-context";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Coffee,
  Flame,
  Leaf,
  Sparkles,
  Wallet,
} from "lucide-react";
import { discoverProducts, type Mood } from "@/lib/storefront";
import { ProductCard } from "@/components/menu/product-card";
import { useMoney } from "@/context/settings-context";
import { cn } from "@/lib/utils";
import { basePrice } from "@/lib/menu-planner";
import type { ProductDTO } from "@/lib/types";
const MOODS = [
  {
    id: "signature",
    label: "Cafe signatures",
    icon: Sparkles,
    description: "The cafe’s featured dishes and best sellers.",
  },
  {
    id: "comfort",
    label: "Something comforting",
    icon: Coffee,
    description: "A warm cup, a mild bite, a slower moment.",
  },
  {
    id: "bold",
    label: "Bring the heat",
    icon: Flame,
    description: "Medium and hot dishes for a bolder appetite.",
  },
  {
    id: "lighter",
    label: "Vegetarian & mild",
    icon: Leaf,
    description: "Vegetarian choices without medium or hot spice.",
  },
  {
    id: "value",
    label: "Easy on the pocket",
    icon: Wallet,
    description: "Available dishes, sorted by their base menu price.",
  },
] as const;
export function SignatureCollections({ products }: { products: ProductDTO[] }) {
  const money = useMoney();
  const picks = [
    {
      label: "The chai ritual",
      description: "A moment worth slowing down for.",
      slug: "chai",
    },
    {
      label: "Layers of happiness",
      description: "Golden edges. Generous fillings.",
      slug: "parathas",
    },
  ]
    .map((c) => ({
      ...c,
      product: products.find(
        (p) => p.category.slug === c.slug && p.isAvailable && p.stock !== 0,
      ),
    }))
    .filter((c) => c.product);
  if (!picks.length) return null;
  return (
    <section className="section">
      <div className="container">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{<T text="Good company starts here"/>}</p>
            <h2 className="mt-3 max-w-xl text-3xl font-extrabold sm:text-4xl">
              {<T text="A little ritual."/>}<br />{<T text="A lot of flavour."/>}</h2>
          </div>
          <Link
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-chai-700"
            href="/discover"
          >
            {<T text="Find your next favourite"/>}<ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {picks.map((c) => (
            <Link
              key={c.slug}
              href={`/menu/${c.slug}`}
              className="group relative flex min-h-[340px] items-end overflow-hidden rounded-3xl bg-charcoal-900 p-6 sm:min-h-[440px] sm:p-8"
            >
              {c.product!.image && (
                <Image
                  src={c.product!.image}
                  alt={c.product!.name}
                  fill
                  sizes="(max-width:768px) 100vw,50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              )}
              <span
                className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/5"
                aria-hidden
              />
              <div className="relative z-10 w-full">
                <p className="mb-3 inline-block rounded-full border border-white/30 bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                  {<T text="Featuring"/>}{c.product!.name} · {money(basePrice(c.product!))}
                </p>
                <h3 className="text-3xl font-extrabold text-white sm:text-4xl">
                  {c.label}
                </h3>
                <p className="mt-2 text-sm text-white/80">{c.description}</p>
                <span className="mt-5 inline-flex items-center gap-3 text-sm font-bold text-white">
                  {<T text="Explore the collection"/>}{" "}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
export function MoodDiscovery({
  products,
  full = false,
}: {
  products: ProductDTO[];
  full?: boolean;
}) {
  const [mood, setMood] = useState<Mood>("signature");
  const choices = discoverProducts(products, mood);
  const selected = MOODS.find((m) => m.id === mood)!;
  return (
    <section
      className={
        full
          ? "container py-10 md:py-14"
          : "section border-y border-cream-200 bg-cream-100"
      }
    >
      <div className={full ? "" : "container"}>
        <div className="max-w-2xl">
          <p className="eyebrow">{<T text="Let your cravings lead"/>}</p>
          {full ? (
            <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">
              {<T text="What’s your kind of delicious?"/>}</h1>
          ) : (
            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              {<T text="A menu that meets your mood."/>}</h2>
          )}
          <p className="mt-4 text-sm leading-relaxed text-charcoal-600 sm:text-base">
            {<T text="A quick route to the right dish. Choose a mood, compare your shortlist, then make it your own."/>}</p>
        </div>
        <div
          className="no-scrollbar my-7 flex gap-2 overflow-x-auto pb-2"
          aria-label="Discover by mood"
        >
          {MOODS.map((m) => (
            <button
              type="button"
              key={m.id}
              aria-pressed={mood === m.id}
              onClick={() => setMood(m.id)}
              className={cn(
                "inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                mood === m.id
                  ? "border-charcoal-900 bg-charcoal-900 text-cream-50"
                  : "border-cream-300 bg-surface text-charcoal-600 hover:border-chai-400",
              )}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </div>
        <p role="status" className="mb-5 text-sm text-charcoal-500">
          {selected.description}{" "}
          {choices.length
            ? `${choices.length} matches.`
            : "No matches right now—try another mood."}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {choices.slice(0, full ? 12 : 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-charcoal-500">
            {<T text="Base prices shown. Options, delivery and tax are confirmed in your cart."/>}</p>
          <Link
            href={full ? "/meal-finder" : "/discover"}
            className="btn-secondary"
          >
            {full ? "Plan a meal for my budget" : "Explore all moods"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

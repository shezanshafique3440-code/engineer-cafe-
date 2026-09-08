"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, Leaf, Wallet, Wifi, Clock3, ShieldCheck, Sparkles,
  MapPin, Phone, Quote, Instagram,
} from "lucide-react";
import { SectionHeading, Rating, Button } from "@/components/ui";
import { ProductCard } from "@/components/menu/product-card";
import { useMoney, useSettings } from "@/context/settings-context";
import { useCart } from "@/context/cart-context";
import type { CategoryDTO, ProductDTO } from "@/lib/types";

/* ── 3. Popular Categories ─────────────────────────────────────────────── */

export function PopularCategories({ categories }: { categories: CategoryDTO[] }) {
  return (
    <section className="section">
      <div className="container">
        <SectionHeading
          eyebrow="// browse the stack"
          title="What are you craving?"
          description="Seven categories, one very consistent chai standard."
          action={
            <Link href="/menu" className="btn-secondary hidden sm:inline-flex">
              Full Menu <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-7">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
            >
              <Link
                href={`/menu/${category.slug}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="relative aspect-square overflow-hidden bg-cream-200">
                  {category.image && (
                    <Image
                      src={category.image}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 50vw, 15vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/70 to-transparent" aria-hidden />
                  <span className="absolute left-2.5 top-2.5 text-xl" aria-hidden>{category.icon}</span>
                </div>
                <div className="p-3">
                  <h3 className="truncate text-sm font-bold text-charcoal-900 transition-colors group-hover:text-chai-700">
                    {category.name}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-charcoal-400">
                    {category.productCount} item{category.productCount === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 4/5. Product rails ────────────────────────────────────────────────── */

export function ProductRail({
  eyebrow,
  title,
  description,
  products,
  href,
  tone = "cream",
}: {
  eyebrow: string;
  title: string;
  description: string;
  products: ProductDTO[];
  href: string;
  tone?: "cream" | "white";
}) {
  if (products.length === 0) return null;

  return (
    <section className={tone === "white" ? "section bg-white" : "section"}>
      <div className="container">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
          action={
            <Link href={href} className="btn-secondary hidden sm:inline-flex">
              See all <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {products.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
        <Link href={href} className="btn-secondary mt-6 w-full sm:hidden">
          See all <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/* ── 6. Engineer's Deals ───────────────────────────────────────────────── */

export function EngineerDeals({ deals }: { deals: ProductDTO[] }) {
  const money = useMoney();
  const { addItem } = useCart();

  if (deals.length === 0) return null;

  return (
    <section className="section relative overflow-hidden bg-charcoal-900 text-cream-50">
      <div className="blueprint absolute inset-0 opacity-[0.13]" aria-hidden />
      <div className="container relative">
        <div className="mb-9 max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-chai-400">
            {"// engineer's deals"}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-cream-50 md:text-3xl">
            Combos that compile on the first try.
          </h2>
          <p className="mt-2 text-sm text-charcoal-300 md:text-base">
            Bundled chai and parathas at prices built for student budgets. Managed live from the cafe.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal, index) => {
            const price = deal.discountPrice ?? deal.price;
            const saving = deal.discountPrice ? deal.price - deal.discountPrice : 0;

            return (
              <motion.article
                key={deal.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: Math.min(index * 0.07, 0.3) }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-charcoal-700 bg-charcoal-800 transition-colors hover:border-chai-500/60"
              >
                <Link href={`/menu/combos/${deal.slug}`} className="relative block aspect-[16/9] overflow-hidden bg-charcoal-700">
                  {deal.image && (
                    <Image
                      src={deal.image}
                      alt={deal.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  {saving > 0 && (
                    <span className="absolute right-3 top-3 rounded-lg bg-chilli-500 px-2.5 py-1 text-xs font-bold text-white">
                      Save {money(saving)}
                    </span>
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-bold text-cream-50">{deal.name}</h3>
                  <p className="mt-1.5 text-sm leading-snug text-charcoal-300">{deal.description}</p>

                  {deal.comboItems && deal.comboItems.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {deal.comboItems.map((item) => (
                        <li key={item.productName} className="flex items-center gap-2 text-xs text-charcoal-300">
                          <span className="h-1 w-1 rounded-full bg-chai-400" aria-hidden />
                          {item.quantity} × {item.productName}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                    <div>
                      <span className="block text-2xl font-extrabold leading-none text-cream-50">
                        {money(price)}
                      </span>
                      {deal.discountPrice && (
                        <span className="text-xs text-charcoal-500 line-through">{money(deal.price)}</span>
                      )}
                    </div>
                    <Button
                      onClick={() => addItem(deal)}
                      className="bg-chai-500 hover:bg-chai-400"
                      aria-label={`Add ${deal.name} to cart`}
                    >
                      Add Deal
                    </Button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── 7. Why Engineer Cafe ──────────────────────────────────────────────── */

const WHY = [
  { icon: Leaf, title: "Fresh, every single round", body: "Dough kneaded through the day, chai brewed per order. Nothing sits under a lamp." },
  { icon: Wallet, title: "Student-friendly pricing", body: "Cutting chai from Rs. 90 and combos under Rs. 400 — daily, not just on promos." },
  { icon: Wifi, title: "Built for long sessions", body: "Fast Wi-Fi, power sockets at every table and nobody rushing you off it." },
  { icon: Clock3, title: "Open till 2 AM", body: "Because deadlines don't respect closing time and neither do we." },
  { icon: ShieldCheck, title: "Hygiene you can see", body: "Open kitchen, sealed packaging on delivery, temperature-checked every service." },
  { icon: Sparkles, title: "Made to your spec", body: "Sugar level, strength, add-ons — configure your chai like a build flag." },
];

export function WhyEngineerCafe() {
  return (
    <section className="section bg-white">
      <div className="container">
        <SectionHeading
          eyebrow="// why engineer cafe"
          title="Six reasons this became the campus default."
          description="Good chai is a solved problem. We just refuse to regress it."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.06, 0.3) }}
              className="rounded-2xl border border-cream-200 bg-cream-50 p-5 transition-colors hover:border-chai-300"
            >
              <span className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl bg-chai-100 text-chai-600">
                <item.icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <h3 className="text-base font-bold text-charcoal-900">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-charcoal-500">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 8. Customer reviews ───────────────────────────────────────────────── */

export function CustomerReviews({
  reviews,
}: {
  reviews: { id: string; author: string; rating: number; comment: string; productName: string }[];
}) {
  if (reviews.length === 0) return null;

  return (
    <section className="section">
      <div className="container">
        <SectionHeading
          eyebrow="// customer reviews"
          title="What the regulars say."
          description="Real reviews from customers who actually received their order."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reviews.slice(0, 6).map((review, index) => (
            <motion.figure
              key={review.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.06, 0.3) }}
              className="flex flex-col rounded-2xl border border-cream-200 bg-white p-5 shadow-soft"
            >
              <Quote className="h-5 w-5 text-chai-300" aria-hidden />
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-charcoal-700">
                “{review.comment}”
              </blockquote>
              <figcaption className="mt-4 flex items-center justify-between gap-3 border-t border-cream-200 pt-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-charcoal-900">{review.author}</p>
                  <p className="truncate text-xs text-charcoal-400">on {review.productName}</p>
                </div>
                <Rating value={review.rating} size={12} />
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 9. Cafe experience ────────────────────────────────────────────────── */

export function CafeExperience() {
  return (
    <section className="section bg-cream-100">
      <div className="container grid items-center gap-10 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          {[
            { src: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=700&q=70", alt: "Students working together at a cafe table", tall: true },
            { src: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=700&q=70", alt: "Warm cafe interior with wooden seating" },
            { src: "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=700&q=70", alt: "A freshly cooked stuffed paratha" },
          ].map((image, index) => (
            <div
              key={image.src}
              className={`relative overflow-hidden rounded-2xl bg-cream-200 ${
                index === 0 ? "row-span-2 aspect-[3/4.4]" : "aspect-square"
              }`}
            >
              <Image src={image.src} alt={image.alt} fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover" />
            </div>
          ))}
        </div>

        <div>
          <p className="eyebrow">{"// the cafe experience"}</p>
          <h2 className="mt-2 text-2xl font-bold md:text-3xl">
            A table that doesn&apos;t ask you to leave.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-charcoal-600 md:text-base">
            Engineer Cafe was built around the way students and engineers actually work — long
            sittings, half-finished assignments, group debates, and a chai order roughly every
            ninety minutes. Sockets at every table, Wi-Fi that survives a video call, and a kitchen
            that stays open until 2 AM.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Power socket and lamp at every table",
              "Quiet corner for solo work, long table for group projects",
              "Free refills on cutting chai during exam weeks",
              "Whiteboard wall — yes, you can use it",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-charcoal-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-chai-500" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <Link href="/about" className="btn-secondary mt-7">
            Read our story <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── 10. Social ────────────────────────────────────────────────────────── */

export function SocialSection() {
  const settings = useSettings();
  const images = [
    "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=500&q=65",
    "https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=500&q=65",
    "https://images.unsplash.com/photo-1610970881699-44a5587cabec?auto=format&fit=crop&w=500&q=65",
    "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=500&q=65",
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=500&q=65",
    "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=500&q=65",
  ];

  return (
    <section className="section bg-white">
      <div className="container">
        <SectionHeading
          eyebrow="// @engineercafe.pk"
          title="Tag us and land on this wall."
          description="Post your chai break with #EngineerCafe — we repost the good ones."
          action={
            settings.instagramUrl ? (
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary hidden sm:inline-flex"
              >
                <Instagram className="h-4 w-4" aria-hidden /> Follow us
              </a>
            ) : undefined
          }
        />
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-6">
          {images.map((src, index) => (
            <a
              key={src}
              href={settings.instagramUrl ?? "#"}
              target={settings.instagramUrl ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-xl bg-cream-200"
              aria-label={`Engineer Cafe photo ${index + 1} on Instagram`}
            >
              <Image src={src} alt="" fill sizes="(max-width: 768px) 33vw, 16vw" className="object-cover transition-transform duration-500 group-hover:scale-110" />
              <span className="absolute inset-0 flex items-center justify-center bg-charcoal-900/0 transition-colors group-hover:bg-charcoal-900/40">
                <Instagram className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 11. Location ──────────────────────────────────────────────────────── */

export function LocationSection() {
  const settings = useSettings();
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(settings.mapsQuery)}&output=embed`;

  return (
    <section className="section">
      <div className="container">
        <SectionHeading eyebrow="// find us" title="Come sit with us." description={settings.openingHours} />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-1">
            {[
              { icon: MapPin, label: "Address", value: settings.address, href: `https://www.google.com/maps/search/${encodeURIComponent(settings.mapsQuery)}` },
              { icon: Phone, label: "Phone", value: settings.phone, href: `tel:${settings.phone.replace(/\s/g, "")}` },
              { icon: Clock3, label: "Opening hours", value: settings.openingHours },
            ].map((item) => (
              <div key={item.label} className="surface flex gap-3.5 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chai-100 text-chai-600">
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">{item.label}</p>
                  {item.href ? (
                    <a
                      href={item.href}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="mt-0.5 block text-sm font-medium text-charcoal-800 hover:text-chai-700"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <p className="mt-0.5 text-sm font-medium text-charcoal-800">{item.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-cream-200 bg-cream-200 lg:col-span-2">
            <iframe
              src={mapSrc}
              title={`Map showing ${settings.cafeName}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-[320px] w-full border-0 sm:h-full sm:min-h-[380px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 12. Final CTA ─────────────────────────────────────────────────────── */

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-chai-600 py-16 text-cream-50 md:py-20">
      <div className="blueprint absolute inset-0 opacity-20" aria-hidden />
      <div className="container relative text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-chai-100">
          {"// ready when you are"}
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-extrabold text-cream-50 md:text-4xl">
          Low battery? Recharge with chai.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-chai-100 md:text-base">
          Delivery across Gulberg in about 30 minutes, or pick up at the counter in 15.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/menu" className="btn bg-cream-50 px-6 py-3.5 text-base text-charcoal-900 hover:bg-white">
            Order Now
          </Link>
          <Link href="/menu/combos" className="btn border border-cream-50/40 px-6 py-3.5 text-base text-cream-50 hover:bg-cream-50/10">
            See Combos
          </Link>
        </div>
      </div>
    </section>
  );
}

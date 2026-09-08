"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Clock, Star, Truck } from "lucide-react";

const FLOATING = [
  { symbol: "∑", top: "12%", left: "6%", delay: 0 },
  { symbol: "λ", top: "68%", left: "10%", delay: 0.6 },
  { symbol: "π", top: "22%", right: "8%", delay: 1.1 },
  { symbol: "Ω", top: "76%", right: "12%", delay: 1.6 },
  { symbol: "∫", top: "44%", left: "3%", delay: 2.1 },
];

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden border-b border-cream-200 bg-cream-100">
      <div className="blueprint absolute inset-0 opacity-70" aria-hidden />
      <div
        className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-chai-200/35 blur-3xl"
        aria-hidden
      />

      {!reduceMotion &&
        FLOATING.map((item) => (
          <motion.span
            key={item.symbol}
            className="pointer-events-none absolute hidden select-none font-display text-3xl text-chai-400/35 lg:block"
            style={{ top: item.top, left: item.left, right: item.right }}
            animate={{ y: [0, -14, 0], opacity: [0.3, 0.55, 0.3] }}
            transition={{ duration: 6, repeat: Infinity, delay: item.delay, ease: "easeInOut" }}
            aria-hidden
          >
            {item.symbol}
          </motion.span>
        ))}

      <div className="container relative grid items-center gap-10 py-14 md:py-20 lg:grid-cols-2 lg:gap-14 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-chai-300 bg-white/70 px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-chai-700 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-circuit-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-circuit-500" />
            </span>
            Open now · Gulberg III, Lahore
          </span>

          <h1 className="mt-5 text-[2.1rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Chai. Paratha. Aur{" "}
            <span className="relative whitespace-nowrap text-chai-600">
              Engineering
              <svg
                className="absolute -bottom-1 left-0 w-full text-chai-300"
                viewBox="0 0 200 8"
                fill="none"
                aria-hidden
              >
                <path d="M2 5.5C40 2 90 1.5 198 4.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>{" "}
            Wali Vibes.
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-charcoal-600 sm:text-lg">
            Your perfect chai break starts here. Karak chai, tawa-fresh parathas and
            student-friendly deals — served from 8 AM to 2 AM.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/menu" className="btn-primary group" style={{ padding: "0.875rem 1.5rem" }}>
              Explore Menu
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link href="/menu/combos" className="btn-secondary" style={{ padding: "0.875rem 1.5rem" }}>
              Order Now
            </Link>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-cream-300 pt-6">
            {[
              { icon: Clock, value: "15 min", label: "Avg. prep time" },
              { icon: Star, value: "4.8", label: "Customer rating" },
              { icon: Truck, value: "Rs. 80", label: "Delivery fee" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <stat.icon className="mb-1.5 h-4 w-4 text-chai-500" aria-hidden />
                  <span className="block text-lg font-extrabold leading-none text-charcoal-900">
                    {stat.value}
                  </span>
                  <span className="mt-1 block text-[11px] text-charcoal-500">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="relative aspect-[4/3.4] overflow-hidden rounded-[1.75rem] border border-cream-300 bg-cream-200 shadow-lift sm:aspect-[4/3]">
            <Image
              src="https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=1200&q=75"
              alt="A cup of karak chai served beside a fresh paratha at Engineer Cafe"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/45 via-transparent to-transparent" aria-hidden />

            {/* Steam rising from the chai */}
            {!reduceMotion && (
              <div className="pointer-events-none absolute left-[26%] top-[14%] flex gap-2.5" aria-hidden>
                {[0, 0.9, 1.8].map((delay) => (
                  <span
                    key={delay}
                    className="h-10 w-[3px] animate-steam rounded-full bg-white/60 blur-[2px]"
                    style={{ animationDelay: `${delay}s` }}
                  />
                ))}
              </div>
            )}

            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
              <div className="rounded-2xl bg-white/95 px-4 py-3 shadow-soft backdrop-blur">
                <p className="font-mono text-[10px] uppercase tracking-wider text-chai-600">Most ordered</p>
                <p className="mt-0.5 text-sm font-bold text-charcoal-900">Special Engineer Chai</p>
                <p className="text-xs text-charcoal-500">
                  <span className="font-bold text-chai-700">Rs. 190</span>{" "}
                  <span className="line-through">Rs. 220</span>
                </p>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="absolute -left-2 top-6 hidden rounded-2xl border border-cream-200 bg-white px-4 py-3 shadow-lift sm:block lg:-left-6"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-charcoal-400">
              status
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-charcoal-900">
              <span className="h-1.5 w-1.5 rounded-full bg-circuit-500" aria-hidden />
              Chai brewing…
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

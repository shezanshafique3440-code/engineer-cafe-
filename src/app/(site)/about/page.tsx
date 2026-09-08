import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Heart, Leaf, Users, Wallet, Sparkles, ShieldCheck } from "lucide-react";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { getSettings } from "@/server/settings";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = buildMetadata({
  title: "Our Story",
  description:
    "Engineer Cafe was built for students, engineers, developers and freelancers — great chai, honest parathas and a table nobody rushes you off.",
  path: "/about",
});

export const revalidate = 300;

const VALUES = [
  { icon: Leaf, title: "Fresh ingredients", body: "Dough kneaded through the day, milk delivered every morning, chai brewed per order — never held on a warmer." },
  { icon: Wallet, title: "Affordable pricing", body: "A cutting chai at Rs. 90 and combos under Rs. 400. Student pricing is our default, not a promotion." },
  { icon: Users, title: "Student-friendly space", body: "Sockets at every table, fast Wi-Fi, a whiteboard wall, and nobody asking you to vacate after one cup." },
  { icon: ShieldCheck, title: "Quality promise", body: "If a paratha reaches you cold or a chai isn't right, tell us on WhatsApp — we remake it, no argument." },
  { icon: Sparkles, title: "Made to your spec", body: "Sugar level, milk, strength, add-ons. Every drink and paratha is configurable, like it should be." },
  { icon: Heart, title: "Built by regulars", body: "Started by four engineering graduates who spent more nights in chai dhabas than in libraries." },
];

export default async function AboutPage() {
  const [settings, counts] = await Promise.all([
    getSettings(),
    Promise.all([
      prisma.product.count({ where: { isAvailable: true } }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
    ]),
  ]);
  const [menuItems, ordersDelivered, customers] = counts;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "About", path: "/about" },
            ]),
          ),
        }}
      />

      <section className="relative overflow-hidden border-b border-cream-200 bg-cream-100">
        <div className="blueprint absolute inset-0 opacity-60" aria-hidden />
        <div className="container relative py-14 md:py-20">
          <p className="eyebrow">{"// our story"}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl">
            A cafe built around the way engineers actually work.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-charcoal-600 md:text-lg">
            {settings.cafeName} started as a simple observation: every good idea in this city gets
            argued out over chai, and almost none of the places serving it were built for people who
            need three hours and a power socket.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-cream-200">
            <Image
              src="https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=1000&q=70"
              alt="The Engineer Cafe seating area with warm lighting and wooden tables"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          <div className="space-y-5 text-sm leading-relaxed text-charcoal-600 md:text-base">
            <h2 className="text-2xl font-bold text-charcoal-900 md:text-3xl">
              It started with a 2 AM problem.
            </h2>
            <p>
              Four of us were finishing a final-year project in a rented room in Gulberg. Every dhaba
              near campus shut by midnight, the one that stayed open served chai that tasted like
              regret, and nowhere had a socket that worked. We ended up making our own karak chai on
              a hot plate at 2 AM — and that&apos;s genuinely where this menu came from.
            </p>
            <p>
              {settings.cafeName} opened as the place we wished had existed: proper doodh patti and
              karak chai, parathas rolled fresh through the day, prices a student can actually
              sustain, and a room that treats a long sitting as normal rather than a problem.
            </p>
            <p>
              Today it&apos;s where students revise, freelancers take calls, teams argue about
              architecture, and friends stay until closing. The engineering theme isn&apos;t a
              gimmick — it&apos;s just who keeps showing up.
            </p>

            <div className="rounded-2xl border-l-4 border-chai-500 bg-cream-100 p-5">
              <p className="font-display text-lg font-bold italic text-charcoal-900">
                “Coffee is optional. Chai is mandatory.”
              </p>
              <p className="mt-1 text-xs text-charcoal-400">— painted on our back wall, non-negotiable</p>
            </div>

            <dl className="grid grid-cols-3 gap-4 border-t border-cream-200 pt-6">
              {[
                { value: `${menuItems}+`, label: "Menu items" },
                { value: `${Math.max(ordersDelivered, 1)}+`, label: "Orders delivered" },
                { value: `${Math.max(customers, 1)}+`, label: "Regulars" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block text-2xl font-extrabold text-chai-700">{stat.value}</span>
                    <span className="mt-0.5 block text-xs text-charcoal-500">{stat.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container">
          <div className="mb-9 max-w-2xl">
            <p className="eyebrow">{"// our mission"}</p>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">
              Serve chai worth interrupting work for.
            </h2>
            <p className="mt-3 text-sm text-charcoal-600 md:text-base">
              Six commitments we hold ourselves to on every order, whether you&apos;re sitting in or
              ordering at 1 AM.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((value) => (
              <div
                key={value.title}
                className="rounded-2xl border border-cream-200 bg-cream-50 p-5 transition-colors hover:border-chai-300"
              >
                <span className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl bg-chai-100 text-chai-600">
                  <value.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <h3 className="text-base font-bold text-charcoal-900">{value.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-charcoal-500">{value.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-charcoal-900 px-6 py-14 text-center text-cream-50 md:px-12">
            <div className="blueprint absolute inset-0 opacity-[0.13]" aria-hidden />
            <div className="relative">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-chai-400">
                {"// come see for yourself"}
              </p>
              <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-extrabold text-cream-50 md:text-4xl">
                Your table is probably free right now.
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-charcoal-300 md:text-base">
                {settings.address} · {settings.openingHours}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/menu" className="btn bg-chai-500 px-6 py-3.5 text-base text-white hover:bg-chai-400">
                  Browse the menu <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/contact" className="btn border border-cream-50/30 px-6 py-3.5 text-base text-cream-50 hover:bg-cream-50/10">
                  Get in touch
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

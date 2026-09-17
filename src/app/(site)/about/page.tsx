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
    "Engineer Cafe started with an engineering degree and no job offer. One kettle, one tawa, and a refusal to keep waiting — this is how it began.",
  path: "/about",
});

export const revalidate = 300;

const VALUES = [
  { icon: Heart, title: "Built, not inherited", body: "Started by an engineering graduate who ran out of interview calls and decided to stop waiting for one. Every rupee here was earned at this counter." },
  { icon: Leaf, title: "Fresh ingredients", body: "Dough kneaded through the day, milk delivered every morning, chai brewed per order — never held on a warmer." },
  { icon: Wallet, title: "Affordable pricing", body: "A cup of chai at Rs. 90. Student pricing is our default, not a promotion — because we remember counting the change." },
  { icon: Users, title: "Student-friendly space", body: "Sockets at every table, room to spread out, and nobody asking you to vacate after one cup." },
  { icon: ShieldCheck, title: "Quality promise", body: "If a paratha reaches you cold or a chai isn't right, tell us on WhatsApp — we remake it, no argument." },
  { icon: Sparkles, title: "Made to your spec", body: "Sugar level, milk, strength, add-ons. Every drink and paratha is configurable, like it should be." },
];

export default async function AboutPage() {
  const [settings, counts, showcase] = await Promise.all([
    getSettings(),
    Promise.all([
      prisma.product.count({ where: { isAvailable: true } }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
    ]),
    // The story deserves the cafe's own food next to it, not a stock photo of
    // somebody else's cafe.
    prisma.product.findFirst({
      where: { isAvailable: true, image: { not: null } },
      orderBy: [{ isFeatured: "desc" }, { soldCount: "desc" }, { ratingAverage: "desc" }],
      select: { name: true, image: true },
    }),
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
            The degree didn&apos;t open a door.
            <br />
            So he built one.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-charcoal-600 md:text-lg">
            {settings.cafeName} did not begin with a business plan or an investor. It began with an
            engineering degree, a folder of unanswered applications, and a young man who finally got
            tired of waiting for somebody else to give him permission to start.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-cream-200">
            {showcase?.image && (
              <Image
                src={showcase.image}
                alt={`${showcase.name} at ${settings.cafeName}`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            )}
          </div>

          <div className="space-y-5 text-sm leading-relaxed text-charcoal-600 md:text-base">
            <h2 className="text-2xl font-bold text-charcoal-900 md:text-3xl">
              He did everything the right way. It still wasn&apos;t enough.
            </h2>
            <p>
              Four years of engineering. The semesters that ate themselves, the nights that ran into
              mornings, the exams survived on chai and stubbornness. And then, at the end of it, the
              degree — held up in a photograph, the proof that the hard part was over.
            </p>
            <p>
              Except the hard part had not even started. What followed was the season nobody warns
              you about: applications sent into silence. Interviews that ended in{" "}
              <em>we&apos;ll let you know</em>. Reference numbers that led nowhere. A qualified
              engineer with a folder full of certificates and absolutely nothing to do on a Monday
              morning.
            </p>
            <p>
              Like everything else in this country, the waiting happened over chai. Cup after cup at
              roadside dhabas, alongside other graduates carrying the same folder and the same
              expression. And somewhere in those long, flat afternoons, the question quietly turned
              itself around. It stopped being <em>who will give me a job?</em> and became{" "}
              <em>why am I still asking?</em>
            </p>

            <div className="rounded-2xl border-l-4 border-chai-500 bg-cream-100 p-5">
              <p className="font-display text-lg font-bold italic text-charcoal-900">
                &ldquo;Job nahi mili. Isliye khud bana li.&rdquo;
              </p>
              <p className="mt-1.5 text-xs text-charcoal-500">
                No one gave him a job. So he built one — and then he built a few more.
              </p>
            </div>

            <p>
              So he stopped asking. The engineering did not go to waste; it simply changed shape. The
              same mind trained to break a problem into variables turned itself on a kettle, a tawa
              and a bag of loose-leaf tea. How hot. How long. How much milk. What ratio of gur to
              patti. He tested it the way he had been taught to test anything — one variable at a
              time, iteration after iteration, until the cup came out right <em>every single time</em>.
            </p>
            <p>
              The first days were small and unglamorous: one burner, one man, and a great deal of
              refusing to be embarrassed. Customers came for the chai and stayed because somebody
              actually cared whether it was good. Word travelled the way it always does — one friend
              telling another. One kettle became two. A stool became a table. A table became a room
              full of students who now treat this place as an extension of their hostel.
            </p>

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
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow justify-center">{"// where it stands today"}</p>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">
              Not a fallback. The actual plan.
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-charcoal-600 md:text-base">
              <p>
                {settings.cafeName} is not the story of a man who failed at engineering and settled
                for a chai stall. It is the story of a man who applied engineering to chai — which,
                as anyone who has argued about doodh patti at 2 AM knows, is a far more serious
                subject than most people are willing to admit.
              </p>
              <p>
                Today the tawa does not get a chance to cool. The menu has grown from a single
                kettle to {menuItems} items — nine kinds of chai, sixteen parathas, anday, and the
                sides that go with them. There is a full kitchen, a team, and a queue that forms
                before the shutters are properly up. Same founder. Same counter. Same obsession with
                getting the ratio right.
              </p>
              <p className="font-semibold text-charcoal-800">
                And if you are sitting here right now with a degree and no offer letter, holding a
                cup he made — take the hint.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
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

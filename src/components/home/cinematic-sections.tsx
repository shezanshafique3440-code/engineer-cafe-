"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  MapPin,
  Quote,
  Sparkles,
  Users,
  GitCompareArrows,
  Coffee,
} from "lucide-react";
import { useMoney, useSettings } from "@/context/settings-context";
import { ProductCard } from "@/components/menu/product-card";
import { ServiceChoice } from "@/components/storefront/order-guidance";
import type { CategoryDTO, ProductDTO } from "@/lib/types";

export function CafeCollections({ products }: { products: ProductDTO[] }) {
  const money = useMoney();
  const collections = [
    {
      slug: "chai",
      number: "01",
      name: "The chai collection",
      subtitle: "A CUP FULL OF COMFORT",
      description: "Your daily ritual, brewed just the way you like it.",
    },
    {
      slug: "parathas",
      number: "02",
      name: "Golden, layer by layer",
      subtitle: "STRAIGHT FROM THE TAWA",
      description: "Crisp edges. Soft centres. All the right fillings.",
    },
    {
      slug: "anday",
      number: "03",
      name: "A brighter beginning",
      subtitle: "MAKE A MORNING OF IT",
      description: "Good mornings start with something made fresh.",
    },
  ].flatMap((collection) => {
    const product = products.find(
      (p) =>
        p.category.slug === collection.slug && p.isAvailable && p.stock !== 0,
    );
    return product ? [{ ...collection, product }] : [];
  });
  if (!collections.length) return null;
  return (
    <section id="cafe-signatures" className="cinema-section cinema-collections">
      <div className="cinema-container">
        <div className="cinema-section-heading reveal">
          <div>
            <p className="cinema-eyebrow">A FEW OF OUR FAVOURITE THINGS</p>
            <h2>
              Find your little <em>happiness.</em>
            </h2>
          </div>
          <Link href="/menu" className="cinema-text-link">
            The full collection <ArrowUpRight size={16} aria-hidden />
          </Link>
        </div>
        <div className="cinema-collection-grid">
          {collections.map((collection) => (
            <Link
              className="cinema-collection-card reveal"
              key={collection.slug}
              href={`/menu/${collection.slug}`}
            >
              <div className="cinema-collection-photo">
                {collection.product.image ? (
                  <Image
                    src={collection.product.image}
                    alt={collection.product.name}
                    fill
                    sizes="(max-width: 600px) 90vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <Coffee size={64} aria-hidden />
                )}
                <span className="cinema-collection-number">
                  {collection.number}
                </span>
                <span className="cinema-round-arrow">
                  <ArrowUpRight size={20} aria-hidden />
                </span>
              </div>
              <div className="cinema-collection-text">
                <p className="cinema-eyebrow">{collection.subtitle}</p>
                <h3>{collection.name}</h3>
                <p>{collection.description}</p>
                <span>
                  Featuring {collection.product.name} ·{" "}
                  {money(
                    collection.product.discountPrice ??
                      collection.product.price,
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CafeStory({ products }: { products: ProductDTO[] }) {
  const paratha = products.find(
    (p) => p.category.slug === "parathas" && p.image,
  );
  const settings = useSettings();
  return (
    <section id="our-story" className="cinema-section cinema-story">
      <div className="cinema-container cinema-story-grid">
        <div className="cinema-story-art reveal">
          <div className="cinema-story-photo">
            <Image
              src="/experience/cafe-atmosphere.webp"
              alt="Warm wood, golden light and a quiet cafe corner — an atmospheric brand illustration"
              fill
              sizes="(max-width: 768px) 90vw, 40vw"
              className="object-cover"
            />
          </div>
          {paratha?.image && (
            <div className="cinema-story-inset">
              <Image
                src={paratha.image}
                alt={paratha.name}
                fill
                sizes="(max-width:768px) 40vw, 18vw"
                className="object-cover"
              />
            </div>
          )}
          <span className="cinema-story-seal" aria-hidden>
            CHAI & GOOD COMPANY <Coffee size={25} /> THE ENGINEER WAY
          </span>
        </div>
        <div className="cinema-story-copy reveal">
          <p className="cinema-eyebrow">MORE THAN WHAT’S IN THE CUP</p>
          <h2>
            A place to pause.
            <br />A reason to <em>stay.</em>
          </h2>
          <p>
            Some of the best ideas happen over chai. So do the best
            conversations, the long catch-ups, and the well-deserved breaks.
          </p>
          <p>
            At {settings.cafeName}, it starts with a good cup and something
            golden from the tawa. The rest is your moment to make.
          </p>
          <Link href="/about" className="cinema-button cinema-button-brown">
            A little about us <ArrowRight size={15} aria-hidden />
          </Link>
          <div className="cinema-story-details">
            <span>
              <Coffee size={17} aria-hidden /> Brewed to order
            </span>
            <span>
              <Users size={17} aria-hidden /> Better together
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SignatureMenu({
  products,
  categories,
}: {
  products: ProductDTO[];
  categories: CategoryDTO[];
}) {
  const [selected, setSelected] = useState("all");
  const available = useMemo(
    () => products.filter((p) => p.isAvailable && p.stock !== 0),
    [products],
  );
  const tabs = categories.filter((c) =>
    available.some((p) => p.category.slug === c.slug),
  );
  const shown = (
    selected === "all"
      ? available
      : available.filter((p) => p.category.slug === selected)
  ).slice(0, 8);
  return (
    <section id="signature-menu" className="cinema-section cinema-signatures">
      <div className="cinema-container">
        <div className="cinema-section-heading reveal">
          <div>
            <p className="cinema-eyebrow">FROM OUR KITCHEN, WITH LOVE</p>
            <h2>
              The usual? Or a new <em>favourite.</em>
            </h2>
          </div>
          <Link href="/menu" className="cinema-text-link">
            See the whole menu <ArrowUpRight size={16} aria-hidden />
          </Link>
        </div>
        <div className="cinema-menu-tabs" aria-label="Filter signature dishes">
          <button
            type="button"
            aria-pressed={selected === "all"}
            onClick={() => setSelected("all")}
          >
            Cafe favourites
          </button>
          {tabs.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={selected === category.slug}
              onClick={() => setSelected(category.slug)}
            >
              {category.name}
            </button>
          ))}
        </div>
        {shown.length ? (
          <div className="cinema-menu-grid">
            {shown.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        ) : (
          <p className="cinema-empty">
            The kitchen is refreshing this collection. Explore the menu for
            available favourites.
          </p>
        )}
      </div>
      <div className="cinema-service-choice">
        <ServiceChoice />
      </div>
    </section>
  );
}

export function CafeVisit() {
  const settings = useSettings();
  return (
    <section id="visit" className="cinema-visit">
      <Image
        src="/experience/cafe-atmosphere.webp"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div className="cinema-visit-shade" aria-hidden />
      <div className="cinema-container cinema-visit-content reveal">
        <p className="cinema-eyebrow">THERE’S ALWAYS ROOM FOR ONE MORE</p>
        <h2>
          Good chai.
          <br />
          <em>Better company.</em>
        </h2>
        <p>
          Leave the rush at the door. Your next favourite moment starts here.
        </p>
        <div className="cinema-visit-details">
          <span>
            <MapPin size={16} aria-hidden />
            {settings.address}
          </span>
          <span>
            <Clock size={16} aria-hidden />
            {settings.openingHours}
          </span>
        </div>
        <div className="cinema-visit-actions">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.mapsQuery || settings.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="cinema-button cinema-button-cream"
          >
            Find our cafe <ArrowUpRight size={16} aria-hidden />
          </a>
          <Link href="/menu" className="cinema-button cinema-button-outline">
            Bring the cafe home <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
      <span className="cinema-atmosphere-caption">
        An illustration of the feeling. Visit us for the real thing.
      </span>
    </section>
  );
}

export function CafeReviews({
  reviews,
}: {
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    author: string;
    productName: string;
  }[];
}) {
  if (!reviews.length) return null;
  return (
    <section className="cinema-section cinema-reviews">
      <div className="cinema-container">
        <div className="cinema-section-heading reveal">
          <div>
            <p className="cinema-eyebrow">THE WORD AROUND THE TABLE</p>
            <h2>
              A few kind <em>words.</em>
            </h2>
          </div>
          <span className="cinema-review-note">
            From approved customer reviews
          </span>
        </div>
        <div className="cinema-review-grid">
          {reviews.map((review) => (
            <article className="cinema-review-card reveal" key={review.id}>
              <Quote size={26} strokeWidth={1} aria-hidden />
              <span
                className="cinema-stars"
                aria-label={`${review.rating} out of 5 stars`}
              >
                {"★".repeat(review.rating)}
                {"☆".repeat(5 - review.rating)}
              </span>
              {review.comment && <blockquote>“{review.comment}”</blockquote>}
              <p>
                {review.author}
                <span>{review.productName}</span>
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CafeConcierge() {
  const links = [
    {
      icon: Sparkles,
      eyebrow: "FOLLOW YOUR CRAVING",
      title: "Find your flavour.",
      copy: "Comforting, bold or easy on the pocket. Start with your mood.",
      href: "/discover",
      cta: "Discover the menu",
    },
    {
      icon: Users,
      eyebrow: "A TABLE FOR EVERYONE",
      title: "Make it a meal.",
      copy: "A little help choosing for your group, your budget and your appetite.",
      href: "/meal-finder",
      cta: "Plan your table",
    },
    {
      icon: GitCompareArrows,
      eyebrow: "DOWN TO THE DELICIOUS DETAILS",
      title: "Spoilt for choice?",
      copy: "Shortlist your favourites. Compare the details. Find your perfect pick.",
      href: "/compare",
      cta: "Your shortlist",
    },
  ];
  return (
    <section className="cinema-section cinema-concierge">
      <div className="cinema-container">
        <div className="cinema-concierge-grid">
          {links.map((item) => (
            <Link
              href={item.href}
              key={item.href}
              className="cinema-concierge-card reveal"
            >
              <item.icon size={24} strokeWidth={1.25} aria-hidden />
              <p className="cinema-eyebrow">{item.eyebrow}</p>
              <h2>{item.title}</h2>
              <p>{item.copy}</p>
              <span>
                {item.cta}
                <ArrowUpRight size={17} aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Pause,
  Play,
  RotateCcw,
  Star,
} from "lucide-react";
import { useSettings, useMoney } from "@/context/settings-context";
import { heroSlot } from "@/lib/hero-catalog";
import { DishPerformance } from "./dish-performance";
import { DishChooser, DishIngredients } from "./dish-dialogs";
import { dishExperience, isExperienceProduct } from "@/lib/dish-experience";
import type { ProductDTO } from "@/lib/types";

export const HERO_ROTATE_MS = 5200;

export function Hero({
  products,
  catalog,
  rating,
  reviewCount,
  menuCount,
  prepMinutes,
}: {
  products: ProductDTO[];
  catalog: ProductDTO[];
  rating: number | null;
  reviewCount: number;
  menuCount: number;
  prepMinutes: number;
}) {
  const settings = useSettings();
  const money = useMoney();
  const reduced = useReducedMotion();
  const journey = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const inView = useInView(hero, { amount: 0.15 });
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [replay, setReplay] = useState(0);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [readyId, setReadyId] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const menu = useMemo(() => catalog.filter(isExperienceProduct), [catalog]);
  const extra = menu.find((p) => p.id === extraId);
  const picks = extra
    ? [extra, ...products.filter((p) => p.id !== extra.id)].slice(0, 5)
    : products;
  const onReady = useCallback((id: string) => setReadyId(id), []);
  const { scrollYProgress } = useScroll({
    target: journey,
    offset: ["start start", "end end"],
  });
  const cupDescent = useTransform(scrollYProgress, [0, 0.5, 1], [-14, 45, 85]);
  const cupScale = useTransform(scrollYProgress, [0, 1], [1, 0.88]);
  const atmosphere = useTransform(scrollYProgress, [0, 0.6, 1], [1, 0.18, 0]);
  const featured = picks[active] ?? picks[0] ?? null;
  const count = picks.length;
  const profile = featured ? dishExperience(featured) : null;
  const playing =
    !paused &&
    !reduced &&
    !hidden &&
    inView &&
    !keyboardFocus &&
    !chooserOpen &&
    !ingredientsOpen &&
    (!featured || readyId === featured.id);

  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  useEffect(() => {
    setActive((i) => (i < count ? i : 0));
  }, [count]);
  useEffect(() => {
    if (!playing || count < 2) return;
    const timer = window.setInterval(
      () => setActive((i) => (i + 1) % count),
      HERO_ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [playing, active, count, replay]);

  const choose = (index: number) => {
    setActive(index);
    setReplay((i) => i + 1);
  };
  const step = (delta: number) => {
    if (count) choose((active + delta + count) % count);
  };
  const selectDish = (product: ProductDTO) => {
    const index = picks.findIndex((p) => p.id === product.id);
    if (index >= 0) choose(index);
    else {
      setExtraId(product.id);
      choose(0);
    }
    setChooserOpen(false);
    setKeyboardFocus(false);
  };
  return (
    <div className="cinema-journey" ref={journey}>
      <section
        ref={hero}
        className="cinema-hero hero-performance"
        data-motion={playing ? "playing" : "paused"}
        data-active-product={featured?.slug ?? "none"}
        aria-label="The Engineer Cafe experience"
        aria-roledescription="carousel"
        onFocusCapture={(e) => {
          if (e.target.matches(":focus-visible")) setKeyboardFocus(true);
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget))
            setKeyboardFocus(false);
        }}
      >
        <motion.div
          className="cinema-cafe-backdrop"
          style={reduced ? { opacity: 0 } : { opacity: atmosphere }}
          aria-hidden
        />
        <div className="cinema-hero-glow" aria-hidden />
        <div className="cinema-ribbon cinema-ribbon-one" aria-hidden />
        <div className="cinema-ribbon cinema-ribbon-two" aria-hidden />
        <span className="cinema-ghost-word" aria-hidden>
          {featured?.category.name.toLocaleLowerCase() ?? "cafe"}
        </span>

        <div className="cinema-container cinema-hero-grid">
          <div className="cinema-hero-copy">
            <p className="cinema-eyebrow cinema-hero-eyebrow">
              <span />
              CHAI, PARATHA & A LITTLE THEATRE
            </p>
            <h1 className="cinema-hero-title">
              Made to savour.<em>Worth slowing down.</em>
            </h1>
            <p className="cinema-hero-description">
              Every dish has a little story. Choose a favourite and watch its
              ingredients come alive.
            </p>
            <div className="cinema-hero-actions">
              <Link href="/menu" className="cinema-button cinema-button-cream">
                Explore the menu <ArrowRight size={16} aria-hidden />
              </Link>
              <button
                type="button"
                className="cinema-text-link"
                onClick={() => setChooserOpen(true)}
                aria-haspopup="dialog"
              >
                Choose a dish <ArrowRight size={14} aria-hidden />
              </button>
            </div>
            <p className="cinema-hero-location">
              BREWED WITH HEART <span aria-hidden>·</span> {settings.city}
            </p>
          </div>

          <div className="hero-stage" aria-label="Floating menu showcase">
            <motion.div
              className="hero-vfx-scroll"
              style={reduced ? undefined : { y: cupDescent, scale: cupScale }}
            >
              {featured ? (
                <DishPerformance
                  key={`${featured.id}:${replay}`}
                  product={featured}
                  onReady={onReady}
                />
              ) : (
                <div className="dish-empty-stage">
                  <Coffee size={72} aria-hidden />
                  <p>Explore today’s menu</p>
                </div>
              )}
            </motion.div>
            <div
              className="hero-product-orbit"
              aria-label="Featured menu items"
            >
              {picks.map((product, index) => (
                <button
                  key={product.id}
                  type="button"
                  className="hero-orbit-product"
                  data-slot={heroSlot(index, active, count)}
                  aria-label={`Feature ${product.name}`}
                  aria-pressed={featured?.id === product.id}
                  onClick={() => choose(index)}
                >
                  <span className="hero-orbit-photo">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt=""
                        width={120}
                        height={120}
                        sizes="(max-width: 600px) 60px, 92px"
                        className="object-cover"
                      />
                    ) : (
                      <Coffee size={28} aria-hidden />
                    )}
                  </span>
                  <span className="hero-orbit-label">{product.name}</span>
                </button>
              ))}
            </div>
          </div>

          <aside
            className="cinema-hero-aside"
            data-featured-dish={featured?.slug ?? "none"}
          >
            <span className="cinema-aside-rule" aria-hidden />
            <p className="cinema-eyebrow">
              {featured
                ? `${active + 1} / ${count} · ${featured.category.name}`
                : "YOUR NEXT FAVOURITE"}
            </p>
            <h2>{featured?.name ?? "Find your favourite"}</h2>
            <p className="hero-feature-description">
              {featured?.description ||
                "Freshly made. A little moment, your way."}
            </p>
            {featured && (
              <button
                type="button"
                className="hero-recipe-link"
                onClick={() => setIngredientsOpen(true)}
                aria-haspopup="dialog"
              >
                View ingredients <span>{profile?.ingredients.length ?? 0}</span>
              </button>
            )}
            {featured && (
              <p className="cinema-feature-price">
                {money(featured.discountPrice ?? featured.price)}{" "}
                <span>base price</span>
              </p>
            )}
            <Link
              href={
                featured
                  ? `/menu/${featured.category.slug}/${featured.slug}`
                  : "/menu"
              }
              className="cinema-button cinema-button-outline"
            >
              {featured ? "Make it yours" : "Explore menu"}{" "}
              <ArrowRight size={14} aria-hidden />
            </Link>
            <div className="cinema-hero-rating">
              <Star size={13} fill="currentColor" aria-hidden />
              <span>
                {rating !== null
                  ? `${rating.toFixed(1)} · ${reviewCount} approved reviews`
                  : `${menuCount} menu favourites to discover`}
              </span>
            </div>
          </aside>
        </div>

        <div className="cinema-container cinema-hero-bottom">
          <Link href="#cafe-signatures" className="cinema-scroll-link">
            <span>
              <ArrowDown size={16} aria-hidden />
            </span>
            Scroll to savour the moment
          </Link>
          <div
            className="cinema-scene-controls"
            aria-label="Featured product controls"
          >
            <button
              type="button"
              aria-label="Previous featured item"
              disabled={count < 2}
              onClick={() => step(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="cinema-scene-dots">
              {picks.map((product, n) => (
                <button
                  type="button"
                  key={product.id}
                  aria-label={`Show ${product.name}`}
                  aria-pressed={active === n}
                  onClick={() => choose(n)}
                >
                  <span />
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Next featured item"
              disabled={count < 2}
              onClick={() => step(1)}
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="cinema-motion-toggle"
              aria-label={
                paused ? "Play hero animation" : "Pause hero animation"
              }
              aria-pressed={paused}
              onClick={(e) => {
                setPaused(!paused);
                if (paused) {
                  e.currentTarget.blur();
                  setKeyboardFocus(false);
                }
              }}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}
            </button>
            <button
              type="button"
              className="cinema-motion-toggle"
              aria-label="Replay food experience"
              onClick={(e) => {
                setReplay((i) => i + 1);
                setPaused(false);
                e.currentTarget.blur();
                setKeyboardFocus(false);
              }}
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <p className="cinema-prep-note">
            Made to order <span aria-hidden>·</span> {prepMinutes} min avg. prep
          </p>
        </div>
        <div className="cinema-service-strip">
          <div className="cinema-container">
            <span>
              <i className={settings.isAcceptingOrders ? "is-accepting" : ""} />
              {settings.isAcceptingOrders
                ? "Accepting online orders"
                : "Online ordering paused"}
            </span>
            <span>Fresh from the tawa</span>
            <span>Minimum order {money(settings.minOrderAmount)}</span>
            <Link href="/contact">
              A table. A takeaway. Your call.{" "}
              <ArrowRight size={13} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
      <DishChooser
        products={menu}
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onSelect={selectDish}
      />
      {featured && (
        <DishIngredients
          product={featured}
          open={ingredientsOpen}
          onClose={() => setIngredientsOpen(false)}
        />
      )}
    </div>
  );
}

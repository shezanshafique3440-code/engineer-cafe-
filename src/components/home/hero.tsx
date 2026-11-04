"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Star,
} from "lucide-react";
import { useSettings, useMoney } from "@/context/settings-context";
import type { ProductDTO } from "@/lib/types";

const SCENES = [
  {
    name: "The signature",
    eyebrow: "A LITTLE EVERYDAY LUXURY",
    line: "Slow moments.",
    emphasis: "Beautifully brewed.",
    description:
      "A warm cup. A golden paratha. And a little time for the things that matter.",
    note: "Rich. Comforting. Unmistakably ours.",
  },
  {
    name: "The golden hour",
    eyebrow: "MAKE ROOM FOR A BETTER BREAK",
    line: "Golden hours.",
    emphasis: "Warmer company.",
    description:
      "Let the day slow down. Pull up a chair, find your favourite, and stay a little longer.",
    note: "Your favourite corner of the day.",
  },
  {
    name: "The ritual",
    eyebrow: "CHAI, PARATHA & CONVERSATION",
    line: "Simple rituals.",
    emphasis: "Extraordinary days.",
    description:
      "From the first sip to the last golden layer. Good things are made to be savoured.",
    note: "A little ritual. A lot of soul.",
  },
];
const SCENE_MS = 7200;

export function Hero({
  featured,
  rating,
  reviewCount,
  menuCount,
  prepMinutes,
}: {
  featured: ProductDTO | null;
  rating: number | null;
  reviewCount: number;
  menuCount: number;
  prepMinutes: number;
}) {
  const settings = useSettings();
  const money = useMoney();
  const reducedMotion = useReducedMotion();
  const hero = useRef<HTMLElement>(null);
  const inView = useInView(hero, { amount: 0.15 });
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 60, damping: 24 });
  const y = useSpring(pointerY, { stiffness: 60, damping: 24 });
  const { scrollYProgress } = useScroll({
    target: hero,
    offset: ["start start", "end start"],
  });
  const scrollLift = useTransform(scrollYProgress, [0, 1], [0, -65]);
  const playing =
    !paused && !reducedMotion && !hidden && inView && !interacting;

  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setScene((value) => (value + 1) % SCENES.length),
      SCENE_MS,
    );
    return () => window.clearInterval(timer);
  }, [playing, scene]);

  const current = SCENES[scene];
  const featuredHref = featured
    ? `/menu/${featured.category.slug}/${featured.slug}`
    : "/menu/chai";

  return (
    <section
      ref={hero}
      className="cinema-hero"
      data-scene={scene}
      data-motion={playing ? "playing" : "paused"}
      aria-label="The Engineer Cafe experience"
      aria-roledescription="carousel"
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setInteracting(false);
      }}
      onPointerMove={(event) => {
        if (reducedMotion || event.pointerType !== "mouse") return;
        const rect = event.currentTarget.getBoundingClientRect();
        pointerX.set(((event.clientX - rect.left) / rect.width - 0.5) * 22);
        pointerY.set(((event.clientY - rect.top) / rect.height - 0.5) * 16);
      }}
      onPointerLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
      }}
    >
      <div className="cinema-cafe-backdrop" aria-hidden />
      <div className="cinema-hero-glow" aria-hidden />
      <div className="cinema-ribbon cinema-ribbon-one" aria-hidden />
      <div className="cinema-ribbon cinema-ribbon-two" aria-hidden />
      <span className="cinema-ghost-word" aria-hidden>
        chai
      </span>

      <div className="cinema-container cinema-hero-grid">
        <div className="cinema-hero-copy">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={scene}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : -12 }}
              transition={{ duration: reducedMotion ? 0 : 0.45 }}
            >
              <p className="cinema-eyebrow cinema-hero-eyebrow">
                <span />
                {current.eyebrow}
              </p>
              <h1 className="cinema-hero-title">
                {current.line}
                <em>{current.emphasis}</em>
              </h1>
              <p className="cinema-hero-description">{current.description}</p>
            </motion.div>
          </AnimatePresence>
          <div className="cinema-hero-actions">
            <Link href="/menu" className="cinema-button cinema-button-cream">
              Explore the menu <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="#our-story" className="cinema-text-link">
              Our story <ArrowUpRight size={14} aria-hidden />
            </Link>
          </div>
          <p className="cinema-hero-location">
            BREWED WITH HEART <span aria-hidden>·</span> {settings.city}
          </p>
        </div>

        <div className="cinema-cup-stage">
          <div className="cinema-orbit" aria-hidden />
          <div className="cinema-platform" aria-hidden />
          <div className="cinema-cup-shadow" aria-hidden />
          <motion.div
            className="cinema-cup-parallax"
            style={reducedMotion ? undefined : { y: scrollLift }}
          >
            <motion.div
              className="cinema-cup-pointer"
              style={reducedMotion ? undefined : { x, y }}
            >
              <div className="cinema-cup-float">
                <Image
                  src="/experience/signature-chai.webp"
                  alt="A glass of golden milk chai with a sculpted milk splash and cardamom"
                  width={1254}
                  height={1254}
                  priority
                  sizes="(max-width: 600px) 110vw, (max-width: 1024px) 75vw, 52vw"
                  className="cinema-cup-image"
                />
              </div>
            </motion.div>
          </motion.div>
          <div className="cinema-ingredients" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={`cinema-seed cinema-seed-${n}`} />
            ))}
          </div>
          <span className="cinema-cup-caption" aria-hidden>
            THE ART OF A GOOD CUP
          </span>
        </div>

        <aside className="cinema-hero-aside">
          <span className="cinema-aside-rule" aria-hidden />
          <p className="cinema-eyebrow">YOUR NEXT FAVOURITE</p>
          <h2>{featured?.name ?? "The chai ritual"}</h2>
          <p>{current.note}</p>
          {featured && (
            <p className="cinema-feature-price">
              {money(featured.discountPrice ?? featured.price)}{" "}
              <span>base price</span>
            </p>
          )}
          <Link
            href={featuredHref}
            className="cinema-button cinema-button-outline"
          >
            {featured ? "Make it yours" : "Explore chai"}{" "}
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
          </span>{" "}
          A little more to love
        </Link>
        <div className="cinema-scene-controls" aria-label="Hero scene controls">
          <button
            type="button"
            aria-label="Previous scene"
            onClick={() =>
              setScene((scene + SCENES.length - 1) % SCENES.length)
            }
          >
            <ChevronLeft size={16} />
          </button>
          <div className="cinema-scene-dots">
            {SCENES.map((item, n) => (
              <button
                type="button"
                key={item.name}
                aria-label={`Show ${item.name}`}
                aria-pressed={scene === n}
                onClick={() => setScene(n)}
              >
                <span />
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Next scene"
            onClick={() => setScene((scene + 1) % SCENES.length)}
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="cinema-motion-toggle"
            aria-label={paused ? "Play hero animation" : "Pause hero animation"}
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <span className="sr-only" role="status" aria-live="off">
            Scene {scene + 1} of {SCENES.length}: {current.name}
          </span>
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
            A table. A takeaway. Your call. <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

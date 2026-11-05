"use client";

import Image from "next/image";
import { useEffect, useId, useState, type CSSProperties } from "react";
import { Sparkles, UtensilsCrossed } from "lucide-react";
import { dishExperience, type RecipeIngredient } from "@/lib/dish-experience";
import type { ProductDTO } from "@/lib/types";

const POSITIONS = [
  [28, 20, -18],
  [72, 20, 16],
  [19, 46, -12],
  [81, 46, 12],
  [30, 75, -15],
  [70, 75, 14],
  [50, 8, -8],
  [50, 89, 10],
];
export function IngredientSprite({
  ingredient,
}: {
  ingredient: RecipeIngredient;
}) {
  if (ingredient.sprite === null)
    return (
      <Sparkles
        className="dish-ingredient-icon"
        strokeWidth={1.4}
        aria-hidden
      />
    );
  const extra = ingredient.sprite >= 24;
  const index = extra ? ingredient.sprite - 24 : ingredient.sprite;
  const columns = extra ? 4 : 6;
  const rows = extra ? 2 : 4;
  return (
    <span
      aria-hidden
      className="dish-ingredient-sprite"
      data-atlas={extra ? "extra" : "base"}
      style={{
        backgroundPosition: `${(index % columns) * (100 / (columns - 1))}% ${Math.floor(index / columns) * (100 / (rows - 1))}%`,
      }}
    />
  );
}

export function DishPerformance({
  product,
  onReady,
}: {
  product: ProductDTO;
  onReady: (id: string) => void;
}) {
  const profile = dishExperience(product);
  const [failed, setFailed] = useState(false);
  const id = useId().replace(/:/g, "");
  const ready = () => onReady(product.id);
  useEffect(() => {
    if (!product.image || failed) onReady(product.id);
  }, [product.id, product.image, failed, onReady]);
  return (
    <div
      className="chai-performance dish-experience"
      data-product={product.slug}
      data-family={profile.family}
      data-effect={profile.effect}
      style={
        {
          "--dish-tone": profile.tone,
          "--dish-fluid-filter": profile.fluidFilter,
        } as CSSProperties
      }
    >
      <div className="dish-aura" aria-hidden />
      <div className="chai-stage-halo" aria-hidden />
      <div className="dish-object-shadow" aria-hidden />
      <div className="dish-serving-stage" aria-hidden />
      {profile.wet && (
        <Image
          src="/experience/chai-splash.webp"
          alt=""
          width={1824}
          height={1024}
          sizes="(max-width:600px) 100vw, 46vw"
          className="dish-liquid-splash"
        />
      )}
      <div className="dish-main-object">
        {product.image && !failed ? (
          <Image
            key={product.image}
            src={product.image}
            alt={product.name}
            width={1024}
            height={1024}
            priority
            sizes="(max-width:600px) 75vw, 35vw"
            className="dish-main-image"
            onLoad={ready}
            onError={() => {
              setFailed(true);
              ready();
            }}
          />
        ) : (
          <div className="dish-photo-fallback">
            <UtensilsCrossed size={80} aria-hidden />
            <span>{product.name}</span>
          </div>
        )}
        {!profile.hasIce && (
          <svg
            className="dish-steam"
            viewBox="0 0 150 130"
            fill="none"
            aria-hidden
          >
            {[0, 1, 2].map((n) => (
              <path
                key={n}
                d={`M${40 + n * 35} 125 C${10 + n * 35} 90 ${75 + n * 35} 80 ${40 + n * 35} 50 S${55 + n * 35} 15 ${45 + n * 35} 0`}
              />
            ))}
          </svg>
        )}
      </div>
      {profile.wet && (
        <>
          {profile.hasMilk && (
            <div className="dish-milk-fall" aria-hidden>
              <Image
                src="/experience/chai-stream.webp"
                alt=""
                width={256}
                height={512}
                sizes="110px"
              />
            </div>
          )}
          <div className="dish-liquid-fall" aria-hidden>
            <Image
              src="/experience/chai-stream.webp"
              alt=""
              width={256}
              height={512}
              sizes="110px"
            />
          </div>
          <svg className="dish-liquid-drops" viewBox="0 0 640 640" aria-hidden>
            <defs>
              <linearGradient id={`${id}-fluid`}>
                <stop stopColor={`rgb(${profile.tone})`} />
                <stop offset=".5" stopColor="#fff0cc" />
                <stop offset="1" stopColor={`rgb(${profile.tone})`} />
              </linearGradient>
            </defs>
            {Array.from({ length: 12 }, (_, n) => (
              <ellipse
                key={n}
                cx={360 + (n % 4) * 22}
                cy={280 + (n % 3) * 24}
                rx={3 + (n % 3)}
                ry={6 + (n % 4)}
                fill={`url(#${id}-fluid)`}
                style={
                  {
                    "--drop-x": `${(n - 5) * 15}px`,
                    "--drop-delay": `${n * 0.11}s`,
                  } as CSSProperties
                }
              />
            ))}
          </svg>
        </>
      )}
      {!profile.wet && (
        <div className="dish-food-effects" aria-hidden>
          {profile.hasFlour && <div className="dish-flour-cloud" />}
          {Array.from({ length: 12 }, (_, n) => (
            <i
              key={n}
              className="dish-crumb"
              style={
                {
                  "--crumb-x": `${(n - 5.5) * 30}px`,
                  "--crumb-y": `${30 + (n % 4) * 26}px`,
                  "--crumb-delay": `${n * 0.04}s`,
                } as CSSProperties
              }
            />
          ))}
          {profile.effect === "cheese" && (
            <div className="dish-cheese-pull">
              {[0, 1, 2, 3, 4].map((n) => (
                <i
                  key={n}
                  style={
                    {
                      "--strand-x": `${n * 17}px`,
                      "--strand-angle": `${(n - 2) * 8}deg`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
          {["butter", "chocolate", "cream"].includes(profile.effect) && (
            <svg className="dish-food-drizzle" viewBox="0 0 640 640">
              <path
                d="M250 40 C180 140 430 170 270 270 S440 350 310 460"
                pathLength="1"
              />
            </svg>
          )}
          {profile.effect === "sizzle" && (
            <div className="dish-sizzle-rings">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
      )}
      <ul
        className="dish-ingredient-orbit"
        aria-label={`Ingredients in ${product.name}`}
      >
        {profile.ingredients.slice(0, 8).map((ingredient, n) => (
          <li
            key={ingredient.label.toLocaleLowerCase()}
            className="dish-ingredient"
            style={
              {
                "--ingredient-x": `${POSITIONS[n][0]}%`,
                "--ingredient-y": `${POSITIONS[n][1]}%`,
                "--ingredient-turn": `${POSITIONS[n][2]}deg`,
                "--ingredient-delay": `${n * 0.055}s`,
              } as CSSProperties
            }
            data-ingredient={ingredient.label}
          >
            <span className="dish-ingredient-object">
              <IngredientSprite ingredient={ingredient} />
            </span>
            <span className="dish-ingredient-label">{ingredient.label}</span>
          </li>
        ))}
      </ul>
      {profile.hasIce &&
        [0, 1].map((n) => (
          <div
            className={`dish-recipe-ice dish-recipe-ice-${n}`}
            aria-hidden
            key={n}
          >
            <Image
              src="/experience/ice-cube.webp"
              alt=""
              width={256}
              height={256}
              sizes="80px"
            />
          </div>
        ))}
    </div>
  );
}

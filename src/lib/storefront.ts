import type { ProductDTO } from "./types";
import { basePrice } from "./menu-planner";
export const HISTORY_TTL = 14 * 86_400_000;
export type ViewedItem = { slug: string; at: number };
export function cleanHistory(value: unknown, now = Date.now()): ViewedItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((item): item is ViewedItem => {
      if (
        !item ||
        typeof item.slug !== "string" ||
        !/^[a-z0-9-]{1,150}$/.test(item.slug) ||
        !Number.isFinite(item.at) ||
        item.at > now ||
        now - item.at > HISTORY_TTL ||
        seen.has(item.slug)
      )
        return false;
      seen.add(item.slug);
      return true;
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);
}
export type Mood = "signature" | "comfort" | "bold" | "lighter" | "value";
export function discoverProducts(products: ProductDTO[], mood: Mood) {
  const eligible = products.filter(
    (p) => p.isAvailable && p.stock !== 0 && p.category.slug !== "sides-extras",
  );
  const filtered = eligible.filter((p) =>
    mood === "comfort"
      ? p.category.slug === "chai" ||
        (p.isVegetarian && ["NONE", "MILD"].includes(p.spiceLevel))
      : mood === "bold"
        ? ["MEDIUM", "HOT"].includes(p.spiceLevel)
        : mood === "lighter"
          ? p.isVegetarian && ["NONE", "MILD"].includes(p.spiceLevel)
          : true,
  );
  return filtered
    .sort((a, b) =>
      mood === "value"
        ? basePrice(a) - basePrice(b) || a.name.localeCompare(b.name)
        : Number(b.isFeatured) - Number(a.isFeatured) ||
          b.soldCount - a.soldCount ||
          b.ratingCount - a.ratingCount,
    )
    .slice(0, 12);
}
export function pairingProducts(
  products: ProductDTO[],
  selectedIds: string[],
  selectedCategories: string[],
) {
  const category =
    selectedCategories.includes("parathas") ||
    selectedCategories.includes("anday")
      ? "chai"
      : selectedCategories.includes("chai")
        ? "parathas"
        : "chai";
  return products
    .filter(
      (p) =>
        p.isAvailable &&
        p.stock !== 0 &&
        !selectedIds.includes(p.id) &&
        p.category.slug === category,
    )
    .sort(
      (a, b) =>
        Number(b.isPopular) - Number(a.isPopular) ||
        basePrice(a) - basePrice(b),
    )
    .slice(0, 3);
}
export function cartMilestones(
  subtotal: number,
  discount: number,
  minimum: number,
  freeOver: number | null,
) {
  const food = Math.max(0, subtotal),
    afterDiscount = Math.max(0, food - Math.max(0, discount));
  return {
    minimumRemaining: Math.max(0, minimum - food),
    minimumProgress: minimum > 0 ? Math.min(100, (food / minimum) * 100) : 100,
    freeRemaining:
      freeOver && freeOver > 0 ? Math.max(0, freeOver - afterDiscount) : null,
    freeProgress:
      freeOver && freeOver > 0
        ? Math.min(100, (afterDiscount / freeOver) * 100)
        : null,
  };
}

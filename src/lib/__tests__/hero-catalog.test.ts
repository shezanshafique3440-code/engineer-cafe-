import { test } from "node:test";
import assert from "node:assert/strict";
import { heroCatalog, heroSlot } from "../hero-catalog";
import { DEFAULT_THEME } from "../themes";
import type { ProductDTO } from "../types";
const dish = (
  id: string,
  category: string,
  extra: Partial<ProductDTO> = {},
): ProductDTO => ({
  id,
  name: id,
  slug: id,
  urduName: null,
  description: "",
  longDescription: null,
  price: 100,
  discountPrice: null,
  image: null,
  isAvailable: true,
  isFeatured: false,
  isPopular: true,
  isVegetarian: true,
  spiceLevel: "MILD",
  prepTimeMinutes: 10,
  ingredients: [],
  calories: null,
  stock: 20,
  ratingAverage: 0,
  ratingCount: 0,
  soldCount: 0,
  createdAt: "2026-11-01",
  hasOptions: false,
  category: { id: category, slug: category, name: category },
  ...extra,
});
test("one featured Kashmiri chai does not pin the hero to a single dish", () => {
  const picks = heroCatalog([
    dish("kashmiri", "chai", { isFeatured: true }),
    dish("sada", "chai"),
    dish("aloo", "parathas"),
    dish("cheese", "parathas"),
    dish("omelette", "anday"),
    dish("packaging", "sides-extras"),
    dish("sold", "parathas", { stock: 0 }),
  ]);
  assert.equal(picks.length, 5);
  assert.equal(picks[0].id, "kashmiri");
  assert.equal(new Set(picks.map((p) => p.id)).size, 5);
  assert.deepEqual(
    new Set(picks.map((p) => p.category.slug)),
    new Set(["chai", "parathas", "anday"]),
  );
});
test("hero excludes unavailable, zero-stock, packaging and duplicate items", () => {
  assert.deepEqual(
    heroCatalog([
      dish("a", "chai"),
      dish("a", "chai"),
      dish("off", "chai", { isAvailable: false }),
      dish("sold", "chai", { stock: 0 }),
      dish("packaging", "sides-extras"),
    ]).map((p) => p.id),
    ["a"],
  );
  assert.deepEqual(heroCatalog([]), []);
});
test("small menus stay real and never invent duplicate carousel slides", () => {
  assert.equal(heroCatalog([dish("a", "chai"), dish("b", "chai")]).length, 2);
  assert.equal(heroSlot(0, 0, 1), 0);
});
test("five rotating products have distinct symmetric slots in either direction", () => {
  for (let active = 0; active < 5; active++)
    assert.deepEqual(
      [0, 1, 2, 3, 4].map((i) => heroSlot(i, active, 5)).sort((a, b) => a - b),
      [-2, -1, 0, 1, 2],
    );
});
test("the cafe's default palette remains Chai", () => {
  assert.equal(DEFAULT_THEME, "chai");
});

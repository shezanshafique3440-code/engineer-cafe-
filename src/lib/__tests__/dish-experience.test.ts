import { test } from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS } from "../../../prisma/seed-data";
import {
  dishExperience,
  ingredientSprite,
  isExperienceProduct,
  recipeIngredients,
} from "../dish-experience";
import type { ProductDTO } from "../types";

function dish(name: string, changes: Partial<ProductDTO> = {}): ProductDTO {
  const category = Object.keys(PRODUCTS).find((key) =>
    PRODUCTS[key].some((p) => p.name === name),
  );
  const source = category && PRODUCTS[category].find((p) => p.name === name);
  if (!source || !category) throw new Error(`Unknown menu fixture: ${name}`);
  return {
    id: name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    urduName: source.urduName,
    description: source.description,
    longDescription: null,
    price: source.price,
    discountPrice: null,
    image: source.image,
    isAvailable: true,
    isFeatured: false,
    isPopular: false,
    isVegetarian: false,
    spiceLevel: "MILD",
    prepTimeMinutes: 10,
    ingredients: source.ingredients,
    calories: null,
    stock: 20,
    ratingAverage: 0,
    ratingCount: 0,
    soldCount: 0,
    createdAt: "2026-11-05",
    hasOptions: false,
    category: { id: category, slug: category, name: category },
    ...changes,
  };
}

test("Kashmiri chai has a pink splash and only its listed milk and nuts", () => {
  const p = dish("Kashmiri Chai");
  const profile = dishExperience(p);
  assert.equal(profile.family, "rose-chai");
  assert.equal(profile.effect, "splash");
  assert.equal(profile.wet, true);
  assert.equal(profile.hasMilk, true);
  assert.equal(profile.hasIce, false);
  assert.deepEqual(
    profile.ingredients.map((i) => i.label),
    p.ingredients,
  );
  assert.ok(profile.fluidFilter.includes("hue-rotate"));
  const edited = dishExperience({ ...p, ingredients: ["Tea leaves", "Water"] });
  assert.equal(edited.hasMilk, false);
  assert.ok(!edited.ingredients.some((i) => [3, 4].includes(i.sprite ?? -1)));
});

test("aloo and dry parathas show their own recipe without a drink splash or added butter", () => {
  for (const name of ["Aloo Paratha", "Khushk Paratha"]) {
    const profile = dishExperience(dish(name));
    assert.equal(profile.family, "paratha");
    assert.equal(profile.wet, false);
    assert.equal(profile.effect, "crumbs");
    assert.equal(profile.hasFlour, true);
    assert.equal(profile.hasButter, false);
    assert.equal(profile.hasMilk, false);
  }
  assert.deepEqual(
    dishExperience(dish("Aloo Paratha")).ingredients.map((i) => i.sprite),
    [5, 6, 13, 14],
  );
});

test("filled parathas distinguish cheese, chocolate, cream and desi ghee", () => {
  const cases = [
    ["Cheese Paratha", "cheese"],
    ["Chicken Cheese Paratha", "cheese"],
    ["Anda Pizza Paratha", "cheese"],
    ["Chocolate Paratha", "chocolate"],
    ["Malai Paratha", "cream"],
    ["Desi Ghee Paratha", "butter"],
  ] as const;
  for (const [name, effect] of cases) {
    const profile = dishExperience(dish(name));
    assert.equal(profile.family, "paratha", name);
    assert.equal(profile.effect, effect, name);
    assert.equal(profile.wet, false, name);
  }
  const edited = dishExperience(
    dish("Cheese Paratha", { ingredients: ["Wheat flour", "Salt"] }),
  );
  assert.equal(edited.effect, "crumbs", "admin recipe edits change the effect");
  assert.equal(edited.hasCheese, false);
});

test("rolls, eggs, chanay and malai keep their own family and exact recipe", () => {
  const cases = [
    ["Chicken Roll Paratha", "roll", "crumbs"],
    ["Kabab Roll Paratha", "roll", "crumbs"],
    ["Half Fry", "egg", "sizzle"],
    ["Cheese Omelette", "egg", "cheese"],
    ["Shakeel Lahori Chanay (Half)", "curry", "sizzle"],
    ["Malai Plate (Full)", "cream", "cream"],
  ] as const;
  for (const [name, family, effect] of cases) {
    const p = dish(name);
    const profile = dishExperience(p);
    assert.equal(profile.family, family, name);
    assert.equal(profile.effect, effect, name);
    assert.deepEqual(
      profile.ingredients.map((i) => i.label),
      p.ingredients,
      name,
    );
  }
  assert.notEqual(ingredientSprite("Seekh kabab"), ingredientSprite("Chicken"));
});

test("green, black and milk drinks use separate colours without inventing milk or ice", () => {
  const cases = [
    ["Sabz Qehwa", "green-tea", false],
    ["Sulemani Qehwa", "black-tea", false],
    ["Doodh Qehwa", "milk-tea", true],
    ["Coffee", "coffee", true],
  ] as const;
  const tones = new Set<string>();
  for (const [name, family, milk] of cases) {
    const profile = dishExperience(dish(name));
    assert.equal(profile.family, family, name);
    assert.equal(profile.wet, true, name);
    assert.equal(profile.hasMilk, milk, name);
    assert.equal(profile.hasIce, false, name);
    tones.add(profile.tone);
  }
  assert.equal(tones.size, 4);
  assert.equal(
    dishExperience(dish("Coffee", { ingredients: ["Coffee", "Ice"] })).hasIce,
    true,
  );
});

test("every listed food ingredient has art and no menu recipe is expanded", () => {
  for (const source of Object.values(PRODUCTS).flat()) {
    const p = dish(source.name);
    if (!isExperienceProduct(p)) continue;
    const ingredients = dishExperience(p).ingredients;
    assert.deepEqual(
      ingredients.map((i) => i.label),
      source.ingredients,
      p.name,
    );
    assert.ok(
      ingredients.every((i) => i.sprite !== null),
      `Missing art: ${p.name}`,
    );
    assert.ok(
      ingredients.every((i) => i.sprite! >= 0 && i.sprite! < 32),
      p.name,
    );
  }
});

test("empty, duplicate and unfamiliar recipes stay honest; Urdu labels remain intact", () => {
  assert.deepEqual(
    recipeIngredients([" Milk ", "milk", "", "Ｍｉｌｋ", "Chef’s secret"]),
    [
      { label: "Milk", sprite: 0 },
      { label: "Chef’s secret", sprite: null },
    ],
  );
  assert.deepEqual(
    dishExperience(dish("Aloo Paratha", { ingredients: [] })).ingredients,
    [],
  );
  assert.equal(ingredientSprite("No sugar"), null);
  assert.equal(ingredientSprite("Without butter"), null);
  assert.equal(ingredientSprite("آلو"), 6);
  assert.equal(ingredientSprite("پستہ"), 4);
});

test("the whole-menu chooser excludes unavailable food and packaging but allows an unlisted recipe", () => {
  const p = dish("Aloo Paratha");
  assert.equal(isExperienceProduct(p), true);
  assert.equal(isExperienceProduct({ ...p, ingredients: [] }), true);
  assert.equal(isExperienceProduct({ ...p, isAvailable: false }), false);
  assert.equal(isExperienceProduct({ ...p, stock: 0 }), false);
  assert.equal(isExperienceProduct({ ...p, stock: null }), true);
  assert.equal(isExperienceProduct(dish("Disposable Charges")), false);
  assert.equal(
    isExperienceProduct({ ...p, ingredients: ["Packaging"] }),
    false,
  );
});

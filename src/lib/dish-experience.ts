import type { ProductDTO } from "./types";

export type DishFamily =
  | "rose-chai"
  | "milk-tea"
  | "green-tea"
  | "black-tea"
  | "coffee"
  | "paratha"
  | "roll"
  | "egg"
  | "curry"
  | "cream"
  | "dish";
export type DishEffect =
  | "splash"
  | "cheese"
  | "chocolate"
  | "cream"
  | "butter"
  | "crumbs"
  | "sizzle";
export type RecipeIngredient = { label: string; sprite: number | null };
const normalise = (s: string) => s.normalize("NFKC").toLocaleLowerCase().trim();

// Base atlas: 6 × 4. Extra atlas: 4 × 2, starting at index 24.
// Labels always come from the menu; an image never adds a recipe ingredient.
export function ingredientSprite(label: string): number | null {
  const key = normalise(label);
  if (/^(no |without |free from )/.test(key)) return null;
  const rules: [RegExp, number][] = [
    [/pistach|pista|پستہ/, 4],
    [/almond|badam|بادام/, 3],
    [/coffee|کافی/, 17],
    [/green tea|سبز/, 31],
    [/tea|چائے|قہوہ/, 1],
    [/milk|malai|cream|دودھ|ملائی/, 0],
    [/jaggery|\bgur\b|گڑ/, 20],
    [/sugar|cheeni|چینی/, 2],
    [/flour|\batta\b|آٹا/, 5],
    [/potato|aloo|آلو/, 6],
    [/mozzarella|cheese|چیز/, 7],
    [/butter|مکھن/, 8],
    [/chicken|چکن/, 9],
    [/\beggs?\b|anda|انڈ/, 10],
    [/onion|pyaz|پیاز/, 11],
    [/pizza sauce|tomato sauce/, 21],
    [/tomato|tamatar|ٹماٹر/, 12],
    [/chilli|chili|مرچ/, 13],
    [/oregano/, 30],
    [/coriander|herb|دھنیا/, 14],
    [/chickpea|chanay|chana|چنے/, 15],
    [/chocolate|cocoa|چاکلیٹ/, 16],
    [/\bice\b|برف/, 23],
    [/water|پانی/, 18],
    [/ghee|\boil\b|گھی|تیل/, 19],
    [/salt|نمک/, 22],
    [/paratha|پراٹھا/, 24],
    [/kabab|kebab|کباب/, 25],
    [/chutney|چٹنی/, 26],
    [/sauce/, 27],
    [/lahori masala/, 29],
    [/spices|masala|مصالح/, 28],
  ];
  return rules.find(([pattern]) => pattern.test(key))?.[1] ?? null;
}

export function recipeIngredients(values: string[]): RecipeIngredient[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const label = value.trim();
    const key = normalise(label);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [{ label, sprite: ingredientSprite(label) }];
  });
}

export function isExperienceProduct(p: ProductDTO): boolean {
  return (
    p.isAvailable &&
    p.stock !== 0 &&
    !/disposable|packaging|packing.charges/i.test(`${p.name} ${p.slug}`) &&
    !(
      p.ingredients.length > 0 &&
      p.ingredients.every((i) => /^(packaging|disposable)$/i.test(i.trim()))
    )
  );
}

export function dishExperience(product: ProductDTO) {
  const ingredients = recipeIngredients(product.ingredients);
  const sprites = new Set(ingredients.map((i) => i.sprite));
  const name = normalise(`${product.name} ${product.slug}`);
  const category = product.category.slug;
  let family: DishFamily = "dish";
  if (/kashmiri|gulabi|pink.chai|کشمیری/.test(name)) family = "rose-chai";
  else if (/\broll\b|رول/.test(name)) family = "roll";
  else if (category === "parathas" || /paratha|پراٹھا/.test(name))
    family = "paratha";
  else if (category === "anday" || /omelette|\bfry\b|آملیٹ/.test(name))
    family = "egg";
  else if (/coffee|کافی/.test(name) || sprites.has(17)) family = "coffee";
  else if (/sabz|green.tea|سبز/.test(name)) family = "green-tea";
  else if (/sulemani|black.tea|سلیمانی/.test(name)) family = "black-tea";
  else if (category === "chai" || /chai|qehwa|چائے|قہوہ/.test(name))
    family = sprites.has(0) ? "milk-tea" : "black-tea";
  else if (sprites.has(15) || /chanay|chana|چنے/.test(name)) family = "curry";
  else if (/malai|cream|ملائی/.test(name)) family = "cream";
  const wet = [
    "rose-chai",
    "milk-tea",
    "green-tea",
    "black-tea",
    "coffee",
  ].includes(family);
  const effect: DishEffect = wet
    ? "splash"
    : sprites.has(16)
      ? "chocolate"
      : sprites.has(7)
        ? "cheese"
        : family === "egg" || family === "curry"
          ? "sizzle"
          : sprites.has(0)
            ? "cream"
            : sprites.has(8) || sprites.has(19)
              ? "butter"
              : "crumbs";
  const tones: Record<DishFamily, string> = {
    "rose-chai": "226 129 160",
    "milk-tea": "211 143 67",
    "green-tea": "143 168 70",
    "black-tea": "168 100 34",
    coffee: "106 62 34",
    paratha: "225 177 81",
    roll: "204 135 54",
    egg: "245 189 63",
    curry: "188 106 41",
    cream: "246 224 179",
    dish: "220 178 109",
  };
  const filters: Record<string, string> = {
    "rose-chai": "hue-rotate(305deg) saturate(.65) brightness(1.22)",
    "green-tea": "hue-rotate(42deg) saturate(.65) brightness(1.08)",
    coffee: "brightness(.62) saturate(.8)",
    "black-tea": "brightness(.86) saturate(.8)",
  };
  return {
    family,
    effect,
    wet,
    tone: tones[family],
    fluidFilter: filters[family] ?? "none",
    ingredients,
    hasMilk: sprites.has(0),
    hasIce: sprites.has(23),
    hasFlour: sprites.has(5),
    hasCheese: sprites.has(7),
    hasButter: sprites.has(8) || sprites.has(19),
  };
}

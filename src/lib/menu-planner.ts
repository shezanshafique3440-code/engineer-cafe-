import type { CartLine, ProductDTO } from "./types";
export function selectedOptions(
  product: ProductDTO,
  ids: string[],
): CartLine["addons"] {
  if (ids.length !== new Set(ids).size)
    throw new Error("Duplicate options in shared cart.");
  const chosen: CartLine["addons"] = [];
  const groups = product.addonGroups ?? [];
  for (const id of ids) {
    const group = groups.find((g) => g.addons.some((a) => a.id === id));
    const addon = group?.addons.find((a) => a.id === id && a.isAvailable);
    if (!group || !addon)
      throw new Error(`An option for ${product.name} is no longer available.`);
    chosen.push({
      id,
      name: addon.name,
      price: addon.price,
      groupName: group.name,
    });
  }
  for (const group of groups) {
    const count = ids.filter((id) =>
      group.addons.some((a) => a.id === id),
    ).length;
    if (
      (group.isRequired && count < Math.max(1, group.minSelect)) ||
      (group.type === "SINGLE" && count > 1) ||
      (group.maxSelect > 0 && count > group.maxSelect)
    ) {
      throw new Error(
        `Please customise ${group.name.toLowerCase()} for ${product.name}.`,
      );
    }
  }
  return chosen;
}
export function defaultOptions(product: ProductDTO): CartLine["addons"] | null {
  const ids: string[] = [];
  for (const group of product.addonGroups ?? []) {
    const needed = group.isRequired ? Math.max(1, group.minSelect) : 0;
    const available = group.addons
      .filter((a) => a.isAvailable)
      .sort(
        (a, b) =>
          Number(b.isDefault) - Number(a.isDefault) ||
          a.price - b.price ||
          a.id.localeCompare(b.id),
      );
    if (available.length < needed || (group.type === "SINGLE" && needed > 1))
      return null;
    ids.push(...available.slice(0, needed).map((a) => a.id));
  }
  try {
    return selectedOptions(product, ids);
  } catch {
    return null;
  }
}
export function basePrice(
  product: Pick<ProductDTO, "price" | "discountPrice">,
) {
  return product.discountPrice !== null &&
    product.discountPrice > 0 &&
    product.discountPrice < product.price
    ? product.discountPrice
    : product.price;
}
export type MealPreferences = {
  budget: number;
  people: number;
  vegetarian: boolean;
  mild: boolean;
  includeDrink: boolean;
  minimum?: number;
};
export function planMeals(
  products: ProductDTO[],
  preferences: MealPreferences,
) {
  if (
    !Number.isInteger(preferences.people) ||
    preferences.people < 1 ||
    preferences.people > 8 ||
    !Number.isFinite(preferences.budget) ||
    preferences.budget <= 0
  )
    return [];
  const catalog = products
    .filter(
      (p) =>
        p.isAvailable &&
        (p.stock === null || p.stock >= preferences.people) &&
        (!preferences.vegetarian || p.isVegetarian) &&
        (!preferences.mild || ["NONE", "MILD"].includes(p.spiceLevel)),
    )
    .map((product) => ({ product, addons: defaultOptions(product) }))
    .filter(
      (p): p is { product: ProductDTO; addons: CartLine["addons"] } =>
        p.addons !== null,
    );
  const mains = catalog.filter((p) =>
    ["parathas", "anday"].includes(p.product.category.slug),
  );
  const drinks = catalog.filter((p) => p.product.category.slug === "chai");
  const choices: {
    key: string;
    lines: {
      product: ProductDTO;
      addons: CartLine["addons"];
      quantity: number;
    }[];
    total: number;
    score: number;
  }[] = [];
  for (const main of mains) {
    for (const drink of preferences.includeDrink ? drinks : [null]) {
      const lines = [main, ...(drink ? [drink] : [])].map((row) => ({
        ...row,
        quantity: preferences.people,
      }));
      const total = lines.reduce(
        (sum, row) =>
          sum +
          (basePrice(row.product) +
            row.addons.reduce((n, a) => n + a.price, 0)) *
            row.quantity,
        0,
      );
      if (total > preferences.budget || total < (preferences.minimum ?? 0))
        continue;
      const score = lines.reduce(
        (sum, row) =>
          sum + Number(row.product.isPopular) * 2 + row.product.ratingAverage,
        0,
      );
      choices.push({
        key: lines.map((l) => l.product.id).join(":"),
        lines,
        total,
        score,
      });
    }
  }
  return choices
    .sort(
      (a, b) =>
        b.score - a.score || a.total - b.total || a.key.localeCompare(b.key),
    )
    .slice(0, 6);
}

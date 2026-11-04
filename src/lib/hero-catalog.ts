import type { ProductDTO } from "./types";

/** Real menu picks, with featured priority and room for more than one category. */
export function heroCatalog(products: ProductDTO[], limit = 5): ProductDTO[] {
  const seen = new Set<string>();
  const available = products
    .filter((p) => {
      if (
        !p.isAvailable ||
        p.stock === 0 ||
        p.category.slug === "sides-extras" ||
        seen.has(p.id)
      )
        return false;
      seen.add(p.id);
      return true;
    })
    .sort(
      (a, b) =>
        Number(b.isFeatured) - Number(a.isFeatured) ||
        Number(b.isPopular) - Number(a.isPopular) ||
        b.soldCount - a.soldCount ||
        b.ratingCount - a.ratingCount,
    );
  const result: ProductDTO[] = [];
  const add = (product: ProductDTO | undefined) => {
    if (
      product &&
      result.length < limit &&
      !result.some((p) => p.id === product.id)
    )
      result.push(product);
  };
  add(available[0]);
  for (const category of ["chai", "parathas", "anday"])
    add(available.find((p) => p.category.slug === category));
  for (const product of available) {
    if (
      result.filter((p) => p.category.slug === product.category.slug).length < 2
    )
      add(product);
  }
  for (const product of available) add(product);
  return result;
}

/** Shortest circular offset; every dish keeps one stable moving DOM element. */
export function heroSlot(index: number, active: number, count: number) {
  if (count < 2) return 0;
  const offset = (index - active + count) % count;
  return offset > Math.floor(count / 2) ? offset - count : offset;
}

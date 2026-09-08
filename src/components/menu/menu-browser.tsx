"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SlidersHorizontal, X, Search, UtensilsCrossed } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { ProductCard, ProductCardSkeleton } from "./product-card";
import { Button, EmptyState, ErrorState, Select } from "@/components/ui";
import { useMoney } from "@/context/settings-context";
import { cn } from "@/lib/utils";
import type { CategoryDTO, ProductDTO } from "@/lib/types";

type Filters = {
  search: string;
  category: string;
  sort: string;
  vegetarian: boolean;
  popular: boolean;
  spicy: boolean;
  minRating: string;
  maxPrice: string;
};

const SORTS = [
  { value: "popular", label: "Most popular" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name (A–Z)" },
];

const PRICE_CAPS = [
  { value: "", label: "Any price" },
  { value: "150", label: "Under Rs. 150" },
  { value: "300", label: "Under Rs. 300" },
  { value: "500", label: "Under Rs. 500" },
  { value: "1000", label: "Under Rs. 1000" },
];

const PER_PAGE = 24;

export function MenuBrowser({
  categories,
  lockedCategory,
  initialSearch = "",
}: {
  categories: CategoryDTO[];
  /** Set on a category page — hides the category picker. */
  lockedCategory?: string;
  initialSearch?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const money = useMoney();

  const [filters, setFilters] = useState<Filters>({
    search: initialSearch || searchParams.get("search") || "",
    category: lockedCategory ?? searchParams.get("category") ?? "",
    sort: searchParams.get("sort") ?? "popular",
    vegetarian: searchParams.get("vegetarian") === "true",
    popular: searchParams.get("popular") === "true",
    spicy: searchParams.get("spicy") === "true",
    minRating: searchParams.get("minRating") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
  });

  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.category) params.set("category", filters.category);
    if (filters.sort !== "popular") params.set("sort", filters.sort);
    if (filters.vegetarian) params.set("vegetarian", "true");
    if (filters.popular) params.set("popular", "true");
    if (filters.spicy) params.set("spicy", "true");
    if (filters.minRating) params.set("minRating", filters.minRating);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    return params.toString();
  }, [filters]);

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(queryString);
        params.set("page", String(targetPage));
        params.set("perPage", String(PER_PAGE));
        const data = await apiGet<{ products: ProductDTO[]; total: number }>(
          `/api/products?${params.toString()}`,
        );
        setProducts((current) => (append ? [...current, ...data.products] : data.products));
        setTotal(data.total);
      } catch {
        setError("Unable to load menu.");
        if (!append) setProducts([]);
      } finally {
        setLoading(false);
      }
    },
    [queryString],
  );

  // Debounced re-fetch on any filter change, and keep the URL shareable.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      void load(1, false);
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(url, { scroll: false });
    }, 260);
    return () => clearTimeout(timer);
  }, [queryString, load, pathname, router]);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const activeCount = [
    filters.vegetarian, filters.popular, filters.spicy,
    Boolean(filters.minRating), Boolean(filters.maxPrice),
    Boolean(!lockedCategory && filters.category),
  ].filter(Boolean).length;

  const reset = () =>
    setFilters({
      search: "",
      category: lockedCategory ?? "",
      sort: "popular",
      vegetarian: false,
      popular: false,
      spicy: false,
      minRating: "",
      maxPrice: "",
    });

  const hasMore = products.length < total;

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-cream-200 bg-cream-50/95 px-4 py-3 backdrop-blur-md md:top-[72px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-300" aria-hidden />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
              placeholder="Search chai, parathas, chicken…"
              aria-label="Search the menu"
              className="field pl-10"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={cn(
              "btn-secondary shrink-0",
              activeCount > 0 && "border-chai-400 text-chai-700",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
            {activeCount > 0 && (
              <span className="ml-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-chai-600 px-1 text-[10px] font-bold text-cream-50">
                {activeCount}
              </span>
            )}
          </button>

          <div className="w-[170px] shrink-0">
            <Select
              value={filters.sort}
              onChange={(e) => update("sort", e.target.value)}
              aria-label="Sort products"
            >
              {SORTS.map((sort) => (
                <option key={sort.value} value={sort.value}>{sort.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 rounded-2xl border border-cream-200 bg-white p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {!lockedCategory && (
                <Select
                  label="Category"
                  value={filters.category}
                  onChange={(e) => update("category", e.target.value)}
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </Select>
              )}

              <Select
                label="Max price"
                value={filters.maxPrice}
                onChange={(e) => update("maxPrice", e.target.value)}
              >
                {PRICE_CAPS.map((cap) => (
                  <option key={cap.value} value={cap.value}>{cap.label}</option>
                ))}
              </Select>

              <Select
                label="Minimum rating"
                value={filters.minRating}
                onChange={(e) => update("minRating", e.target.value)}
              >
                <option value="">Any rating</option>
                <option value="4">4★ and above</option>
                <option value="4.5">4.5★ and above</option>
              </Select>

              <div>
                <span className="label">Quick filters</span>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["vegetarian", "🌱 Veg"],
                    ["popular", "🔥 Popular"],
                    ["spicy", "🌶 Spicy"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => update(key, !filters[key])}
                      aria-pressed={filters[key]}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        filters[key]
                          ? "border-chai-500 bg-chai-50 text-chai-700"
                          : "border-cream-300 text-charcoal-600 hover:border-chai-300",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {activeCount > 0 && (
              <button
                type="button"
                onClick={reset}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-chilli-600 hover:underline"
              >
                <X className="h-3.5 w-3.5" aria-hidden /> Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      <p className="mb-5 text-sm text-charcoal-500" aria-live="polite">
        {loading && products.length === 0
          ? "Loading menu…"
          : `${total} item${total === 1 ? "" : "s"}${filters.search ? ` for “${filters.search}”` : ""}`}
      </p>

      {error && products.length === 0 ? (
        <ErrorState
          title="Unable to load menu."
          description="Check your connection and try again."
          onRetry={() => void load(1, false)}
        />
      ) : loading && products.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="h-6 w-6" />}
          title="404: Chai Not Found."
          description="Nothing matched those filters. Try clearing a few, or search for something simpler like “chai”."
          actionLabel="Clear filters"
          onAction={reset}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index % PER_PAGE} priority={index < 4} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-10 flex justify-center">
              <Button
                variant="secondary"
                loading={loading}
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  void load(next, true);
                }}
              >
                Load more ({total - products.length} left)
              </Button>
            </div>
          )}
        </>
      )}

      <p className="mt-10 text-center font-mono text-xs text-charcoal-300">
        {`// prices in ${money(0).split(" ")[0]} — inclusive of all cafe charges`}
      </p>
    </div>
  );
}

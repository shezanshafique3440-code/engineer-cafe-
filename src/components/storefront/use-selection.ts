"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import type { ProductDTO } from "@/lib/types";
export function useSelection(slugs: string[]) {
  const key = slugs.join(",");
  const [products, setProducts] = useState<ProductDTO[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    if (!key) {
      setProducts([]);
      setError(false);
      setLoading(false);
      return;
    }
    setProducts([]);
    setLoading(true);
    setError(false);
    const query = new URLSearchParams();
    key.split(",").forEach((slug) => query.append("slug", slug));
    apiGet<{ products: ProductDTO[] }>(`/api/storefront-selection?${query}`)
      .then((d) => {
        if (active) setProducts(d.products);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, retry]);
  return { products, loading, error, retry: () => setRetry((v) => v + 1) };
}

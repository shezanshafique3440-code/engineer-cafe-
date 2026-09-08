"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api-client";
import { useSession } from "./session-context";

type FavoritesValue = {
  ids: Set<string>;
  loading: boolean;
  isFavorite: (productId: string) => boolean;
  toggle: (productId: string, productName?: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const data = await apiGet<{ productIds: string[] }>("/api/favorites");
      setIds(new Set(data.productIds));
    } catch {
      setIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (productId: string, productName?: string) => {
      if (!user) {
        toast.error("Please login to save favorites.");
        return;
      }
      // Optimistic flip, rolled back if the request fails.
      const wasFavorite = ids.has(productId);
      setIds((current) => {
        const next = new Set(current);
        if (wasFavorite) next.delete(productId);
        else next.add(productId);
        return next;
      });

      try {
        const data = await apiPost<{ favorited: boolean }>("/api/favorites", { productId });
        toast.success(
          data.favorited
            ? `${productName ?? "Item"} saved to favorites`
            : `${productName ?? "Item"} removed from favorites`,
        );
      } catch {
        setIds((current) => {
          const next = new Set(current);
          if (wasFavorite) next.add(productId);
          else next.delete(productId);
          return next;
        });
        toast.error("Couldn't update your favorites. Please try again.");
      }
    },
    [user, ids],
  );

  const value = useMemo<FavoritesValue>(
    () => ({ ids, loading, isFavorite: (id: string) => ids.has(id), toggle, refresh }),
    [ids, loading, toggle, refresh],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside <FavoritesProvider>.");
  return ctx;
}

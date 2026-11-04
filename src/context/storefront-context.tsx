"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cleanHistory, type ViewedItem } from "@/lib/storefront";
const HISTORY = "ec-viewed-v1",
  COMPARE = "ec-compare-v1";
type Value = {
  history: ViewedItem[];
  compared: string[];
  ready: boolean;
  record: (slug: string) => void;
  toggleCompare: (slug: string) => void;
  clearHistory: () => void;
  clearCompare: () => void;
};
const Context = createContext<Value | null>(null);
export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<ViewedItem[]>([]),
    [compared, setCompared] = useState<string[]>([]),
    [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      setHistory(
        cleanHistory(JSON.parse(localStorage.getItem(HISTORY) ?? "[]")),
      );
      const data = JSON.parse(localStorage.getItem(COMPARE) ?? "[]");
      if (Array.isArray(data))
        setCompared(
          [
            ...new Set(
              data.filter(
                (s): s is string =>
                  typeof s === "string" && /^[a-z0-9-]{1,150}$/.test(s),
              ),
            ),
          ].slice(0, 3),
        );
    } catch {
      /* Empty state if storage is unavailable. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(HISTORY, JSON.stringify(history));
      localStorage.setItem(COMPARE, JSON.stringify(compared));
    } catch {
      /* Browsing still works without storage. */
    }
  }, [ready, history, compared]);
  const record = useCallback((slug: string) => {
    if (!/^[a-z0-9-]{1,150}$/.test(slug)) return;
    setHistory((current) =>
      cleanHistory([
        { slug, at: Date.now() },
        ...current.filter((p) => p.slug !== slug),
      ]),
    );
  }, []);
  const toggleCompare = useCallback((slug: string) => {
    if (!/^[a-z0-9-]{1,150}$/.test(slug)) return;
    setCompared((current) =>
      current.includes(slug)
        ? current.filter((s) => s !== slug)
        : current.length < 3
          ? [...current, slug]
          : current,
    );
  }, []);
  const value = useMemo(
    () => ({
      history,
      compared,
      ready,
      record,
      toggleCompare,
      clearHistory: () => setHistory([]),
      clearCompare: () => setCompared([]),
    }),
    [history, compared, ready, record, toggleCompare],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useStorefront() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("StorefrontProvider is missing.");
  return ctx;
}

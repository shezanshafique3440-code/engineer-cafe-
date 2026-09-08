"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { useMoney } from "@/context/settings-context";
import type { ProductDTO } from "@/lib/types";
import { ENGINEER_QUIPS } from "@/lib/constants";

const SUGGESTIONS = ["chai", "cheese paratha", "chicken", "spicy", "combo", "fries"];

/** Instant, keyboard-accessible menu search. No page reload. */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const money = useMoney();

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
    setTerm("");
    setResults([]);
    setSearched(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const query = term.trim();
    if (query.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await apiGet<{ products: ProductDTO[] }>(
          `/api/products?search=${encodeURIComponent(query)}&perPage=8`,
        );
        if (!cancelled) {
          setResults(data.products);
          setSearched(true);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh] sm:pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-charcoal-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search the menu"
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-lift"
          >
            <div className="flex items-center gap-3 border-b border-cream-200 px-4 py-3.5">
              <Search className="h-5 w-5 shrink-0 text-charcoal-300" aria-hidden />
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                type="search"
                placeholder="Search chai, parathas, snacks…"
                aria-label="Search the menu"
                className="w-full bg-transparent text-base text-charcoal-900 outline-none placeholder:text-charcoal-300"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-chai-500" aria-hidden />}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-charcoal-400 hover:bg-cream-100"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {term.trim().length < 2 ? (
                <div className="p-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-charcoal-400">
                    Try searching
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setTerm(s)}
                        className="rounded-full border border-cream-200 px-3 py-1.5 text-sm text-charcoal-600 transition hover:border-chai-300 hover:bg-chai-50 hover:text-chai-700"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="mt-6 font-mono text-xs text-charcoal-300">
                    {ENGINEER_QUIPS[2]}
                  </p>
                </div>
              ) : results.length === 0 && searched && !loading ? (
                <div className="px-5 py-10 text-center">
                  <p className="font-mono text-sm font-semibold text-charcoal-700">404: Chai Not Found.</p>
                  <p className="mt-1 text-sm text-charcoal-500">
                    Nothing matched “{term}”. Try “chai”, “paratha” or “cheese”.
                  </p>
                </div>
              ) : (
                <ul className="p-2">
                  {results.map((product) => (
                    <li key={product.id}>
                      <Link
                        href={`/menu/${product.category.slug}/${product.slug}`}
                        onClick={onClose}
                        className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-cream-100"
                      >
                        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-cream-200">
                          {product.image && (
                            <Image
                              src={product.image}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-charcoal-900">
                            {product.name}
                          </span>
                          <span className="block truncate text-xs text-charcoal-500">
                            {product.category.name} · {product.description}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-bold text-chai-700">
                          {money(product.discountPrice ?? product.price)}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {results.length > 0 && (
                    <li className="p-2">
                      <Link
                        href={`/menu?search=${encodeURIComponent(term.trim())}`}
                        onClick={onClose}
                        className="block rounded-xl bg-cream-100 px-4 py-2.5 text-center text-sm font-semibold text-chai-700 transition hover:bg-cream-200"
                      >
                        See all results for “{term.trim()}”
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

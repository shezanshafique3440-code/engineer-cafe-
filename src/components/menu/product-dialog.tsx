"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Minus, Plus, Clock, Leaf, Flame, Heart, Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { useCart } from "@/context/cart-context";
import { useFavorites } from "@/context/favorites-context";
import { useMoney } from "@/context/settings-context";
import { Badge, Button, Rating, ErrorState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { SPICE_LABEL } from "@/lib/constants";
import type { AddonGroupDTO, ProductDTO } from "@/lib/types";

/** Default selection = each group's default add-on (e.g. Normal Sugar). */
function defaultSelection(groups: AddonGroupDTO[]): Record<string, string[]> {
  const selection: Record<string, string[]> = {};
  for (const group of groups) {
    const defaults = group.addons.filter((a) => a.isDefault).map((a) => a.id);
    if (defaults.length) {
      selection[group.id] = group.type === "SINGLE" ? defaults.slice(0, 1) : defaults;
    } else if (group.isRequired && group.addons[0]) {
      selection[group.id] = [group.addons[0].id];
    } else {
      selection[group.id] = [];
    }
  }
  return selection;
}

export function ProductDialog({
  slug,
  open,
  onClose,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
}) {
  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const { addItem } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const money = useMoney();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ product: ProductDTO }>(`/api/products/${slug}`);
      setProduct(data.product);
      setSelection(defaultSelection(data.product.addonGroups ?? []));
    } catch {
      setError("We couldn't load this item. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!open) return;
    void load();
    setQuantity(1);
    setNotes("");
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const groups = useMemo(() => product?.addonGroups ?? [], [product]);

  const chosenAddons = useMemo(() => {
    const chosen: { id: string; name: string; price: number; groupName: string }[] = [];
    for (const group of groups) {
      for (const id of selection[group.id] ?? []) {
        const addon = group.addons.find((a) => a.id === id);
        if (addon) chosen.push({ id: addon.id, name: addon.name, price: addon.price, groupName: group.name });
      }
    }
    return chosen;
  }, [groups, selection]);

  const basePrice = product ? product.discountPrice ?? product.price : 0;
  const addonsTotal = chosenAddons.reduce((sum, a) => sum + a.price, 0);
  const lineTotal = (basePrice + addonsTotal) * quantity;

  const missingRequired = groups.filter(
    (g) => g.isRequired && (selection[g.id]?.length ?? 0) < Math.max(1, g.minSelect),
  );

  const choose = (group: AddonGroupDTO, addonId: string) => {
    setSelection((current) => {
      const existing = current[group.id] ?? [];
      if (group.type === "SINGLE") {
        // Required single-select groups always keep exactly one choice.
        if (existing.includes(addonId) && !group.isRequired) return { ...current, [group.id]: [] };
        return { ...current, [group.id]: [addonId] };
      }
      if (existing.includes(addonId)) {
        return { ...current, [group.id]: existing.filter((id) => id !== addonId) };
      }
      if (group.maxSelect > 0 && existing.length >= group.maxSelect) return current;
      return { ...current, [group.id]: [...existing, addonId] };
    });
  };

  const handleAdd = () => {
    if (!product || missingRequired.length > 0) return;
    addItem(product, { addons: chosenAddons, quantity, notes: notes || undefined });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-charcoal-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={product?.name ?? "Product details"}
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.6 }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift sm:max-h-[88vh] sm:rounded-3xl"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/95 p-2 text-charcoal-700 shadow-soft backdrop-blur transition hover:bg-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {loading ? (
              <div className="flex h-72 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-chai-500" aria-label="Loading" />
              </div>
            ) : error || !product ? (
              <div className="p-6">
                <ErrorState title="Unable to load this item." description={error ?? undefined} onRetry={load} />
              </div>
            ) : (
              <>
                <div className="relative aspect-[16/9] shrink-0 bg-cream-200">
                  {product.image && (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 100vw, 512px"
                      className="object-cover"
                    />
                  )}
                  <div className="absolute inset-x-3 top-3 flex flex-wrap gap-1.5">
                    {product.isPopular && <Badge tone="dark">🔥 Popular</Badge>}
                    {product.isVegetarian && (
                      <Badge tone="green"><Leaf className="h-3 w-3" aria-hidden /> Veg</Badge>
                    )}
                    {product.spiceLevel !== "NONE" && (
                      <Badge tone="red"><Flame className="h-3 w-3" aria-hidden /> {SPICE_LABEL[product.spiceLevel]}</Badge>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold leading-tight">{product.name}</h2>
                      <Link
                        href={`/menu/${product.category.slug}`}
                        onClick={onClose}
                        className="mt-0.5 inline-block text-xs font-medium text-chai-600 hover:underline"
                      >
                        {product.category.name}
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggle(product.id, product.name)}
                      aria-label={isFavorite(product.id) ? "Remove from favorites" : "Save to favorites"}
                      aria-pressed={isFavorite(product.id)}
                      className="shrink-0 rounded-full border border-cream-200 p-2.5 transition hover:border-chilli-300"
                    >
                      <Heart
                        className={cn(
                          "h-4 w-4",
                          isFavorite(product.id) ? "fill-chilli-500 text-chilli-500" : "text-charcoal-400",
                        )}
                      />
                    </button>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-4">
                    <Rating value={product.ratingAverage} count={product.ratingCount} />
                    <span className="inline-flex items-center gap-1 text-xs text-charcoal-500">
                      <Clock className="h-3.5 w-3.5" aria-hidden /> {product.prepTimeMinutes} min
                    </span>
                    {product.calories && (
                      <span className="text-xs text-charcoal-500">{product.calories} kcal</span>
                    )}
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-charcoal-600">
                    {product.longDescription || product.description}
                  </p>

                  {product.comboItems && product.comboItems.length > 0 && (
                    <div className="mt-4 rounded-xl border border-chai-200 bg-chai-50 p-3.5">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-chai-700">
                        What&apos;s in this deal
                      </p>
                      <ul className="space-y-1">
                        {product.comboItems.map((item) => (
                          <li key={item.productName} className="text-sm text-charcoal-700">
                            {item.quantity} × {item.productName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {product.ingredients.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal-400">
                        Ingredients
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {product.ingredients.map((ingredient) => (
                          <span
                            key={ingredient}
                            className="rounded-full bg-cream-100 px-2.5 py-1 text-xs text-charcoal-600"
                          >
                            {ingredient}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {groups.map((group) => {
                    const selected = selection[group.id] ?? [];
                    return (
                      <fieldset key={group.id} className="mt-6">
                        <legend className="mb-2.5 flex w-full items-center justify-between gap-2">
                          <span className="text-sm font-bold text-charcoal-900">
                            {group.name}
                            {group.isRequired && <span className="ml-1 text-chilli-500">*</span>}
                          </span>
                          <span className="text-[11px] font-medium text-charcoal-400">
                            {group.type === "SINGLE"
                              ? "Choose one"
                              : `Choose up to ${group.maxSelect}`}
                          </span>
                        </legend>

                        <div className="grid gap-2 sm:grid-cols-2">
                          {group.addons.map((addon) => {
                            const active = selected.includes(addon.id);
                            return (
                              <label
                                key={addon.id}
                                className={cn(
                                  "flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition",
                                  active
                                    ? "border-chai-500 bg-chai-50 text-chai-800"
                                    : "border-cream-200 bg-white text-charcoal-700 hover:border-chai-300",
                                )}
                              >
                                <span className="flex min-w-0 items-center gap-2.5">
                                  <input
                                    type={group.type === "SINGLE" ? "radio" : "checkbox"}
                                    name={group.id}
                                    checked={active}
                                    onChange={() => choose(group, addon.id)}
                                    className="h-4 w-4 shrink-0 accent-chai-600"
                                  />
                                  <span className="truncate font-medium">{addon.name}</span>
                                </span>
                                {addon.price > 0 && (
                                  <span className="shrink-0 text-xs font-bold text-chai-700">
                                    +{money(addon.price)}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    );
                  })}

                  <div className="mt-6">
                    <label htmlFor="item-notes" className="label">
                      Special instructions
                    </label>
                    <input
                      id="item-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                      className="field"
                      placeholder="e.g. less oil, cut in halves"
                    />
                  </div>
                </div>

                <div className="shrink-0 border-t border-cream-200 bg-cream-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {missingRequired.length > 0 && (
                    <p className="mb-2.5 text-xs font-medium text-chilli-600" role="alert">
                      Please choose {missingRequired.map((g) => g.name.toLowerCase()).join(" and ")}.
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex shrink-0 items-center gap-1 rounded-xl border border-cream-300 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="rounded-lg p-2 text-charcoal-600 transition hover:bg-cream-100 disabled:opacity-40"
                        disabled={quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-7 text-center text-sm font-bold" aria-live="polite">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(50, q + 1))}
                        className="rounded-lg p-2 text-charcoal-600 transition hover:bg-cream-100"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <Button
                      onClick={handleAdd}
                      disabled={!product.isAvailable || missingRequired.length > 0}
                      className="flex-1 justify-between"
                      size="lg"
                    >
                      <span>{product.isAvailable ? "Add to Cart" : "Unavailable"}</span>
                      <span>{money(lineTotal)}</span>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

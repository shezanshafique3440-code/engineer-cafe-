"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Copy, Share2, ShoppingBag, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/context/cart-context";
import { useMoney } from "@/context/settings-context";
import { apiGet } from "@/lib/api-client";
import { encodeSharedCart, decodeSharedCart } from "@/lib/shared-cart";
import { basePrice, selectedOptions } from "@/lib/menu-planner";
import { Button } from "@/components/ui";
import type { CartLine, ProductDTO } from "@/lib/types";

export function ShareCartButton() {
  const { lines } = useCart();
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    try {
      const token = encodeSharedCart(lines);
      const url = `${window.location.origin}/shared-cart#items=${token}`;
      if (navigator.share)
        await navigator.share({
          title: "Our Engineer Cafe order",
          text: "Review this meal with live menu prices.",
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(
          "Cart link copied. No personal details or payment data included.",
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError")
        toast.error(
          error.message || "Could not share. Try again in a supported browser.",
        );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      variant="secondary"
      loading={busy}
      disabled={!lines.length || lines.length > 20}
      onClick={() => void share()}
      title="Share up to 20 configured items; excludes personal notes and coupons"
    >
      <Share2 className="h-4 w-4" />
      Share cart
    </Button>
  );
}
type Resolved = {
  key: string;
  quantity: number;
  slug: string;
  product: ProductDTO | null;
  addons: CartLine["addons"];
  error: string | null;
};
export function SharedCartPreview() {
  const requestVersion = useRef(0);
  const [rows, setRows] = useState<Resolved[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [added, setAdded] = useState(false);
  const { addItem, lines, hydrated } = useCart();
  const money = useMoney();
  useEffect(() => {
    let active = true;
    async function load() {
      const version = ++requestVersion.current;
      setLoading(true);
      setError("");
      setAdded(false);
      try {
        const items = decodeSharedCart(
          new URLSearchParams(window.location.hash.slice(1)).get("items") ?? "",
        );
        const cache = new Map<string, ProductDTO>();
        const slugs = [...new Set(items.map((item) => item.slug))];
        let next = 0;
        await Promise.all(
          Array.from({ length: Math.min(4, slugs.length) }, async () => {
            while (next < slugs.length) {
              const slug = slugs[next++];
              try {
                const data = await apiGet<{ product: ProductDTO }>(
                  `/api/products/${encodeURIComponent(slug)}`,
                );
                cache.set(slug, data.product);
              } catch {
                /* Mark this item unavailable below. */
              }
            }
          }),
        );
        const resolved = items.map((item, index): Resolved => {
          const product = cache.get(item.slug) ?? null;
          let message: string | null = null;
          let addons: CartLine["addons"] = [];
          if (!product || !product.isAvailable)
            message = "No longer available.";
          else if (
            product.stock !== null &&
            items
              .filter((i) => i.slug === item.slug)
              .reduce((sum, i) => sum + i.quantity, 0) > product.stock
          )
            message = "The shared quantity exceeds current stock.";
          else {
            try {
              addons = selectedOptions(product, item.addonIds);
            } catch (e) {
              message =
                e instanceof Error
                  ? e.message
                  : "Options changed. Customise this item again.";
            }
          }
          return {
            key: `${item.slug}-${index}`,
            slug: item.slug,
            quantity: item.quantity,
            product,
            addons,
            error: message,
          };
        });
        if (active && version === requestVersion.current) setRows(resolved);
      } catch (e) {
        if (active && version === requestVersion.current)
          setError(
            e instanceof Error ? e.message : "This cart could not load.",
          );
      } finally {
        if (active && version === requestVersion.current) setLoading(false);
      }
    }
    void load();
    window.addEventListener("hashchange", load);
    return () => {
      active = false;
      window.removeEventListener("hashchange", load);
    };
  }, []);
  const ready = rows.filter((row) => row.product && !row.error);
  const total = ready.reduce(
    (sum, row) =>
      sum +
      (basePrice(row.product!) + row.addons.reduce((n, a) => n + a.price, 0)) *
        row.quantity,
    0,
  );
  const add = () => {
    const totals = new Map<string, number>();
    for (const row of ready)
      totals.set(
        row.product!.id,
        (totals.get(row.product!.id) ?? 0) + row.quantity,
      );
    for (const [id, quantity] of totals) {
      const product = ready.find((row) => row.product!.id === id)!.product!;
      const existing = lines
        .filter((line) => line.productId === id)
        .reduce((sum, line) => sum + line.quantity, 0);
      if (
        quantity + existing > 50 ||
        (product.stock !== null && quantity + existing > product.stock)
      ) {
        toast.error(
          `Shared and existing quantities for ${product.name} exceed 50 units or current stock. Add a smaller amount from the menu.`,
        );
        return;
      }
    }
    for (const row of ready)
      addItem(row.product!, {
        quantity: row.quantity,
        addons: row.addons,
        silent: true,
      });
    setAdded(true);
    toast.success(
      "Available shared items added. Review your cart before ordering.",
    );
  };
  return (
    <div className="container max-w-3xl py-10 md:py-16">
      <p className="eyebrow">Better when shared</p>
      <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
        Someone saved you a seat.
      </h1>
      <p className="mt-4 text-sm text-charcoal-600">
        Review their meal with today’s prices and availability. Nothing is
        ordered or added until you choose.
      </p>
      {loading ? (
        <p role="status" className="py-12 text-center">
          Checking the current menu and options…
        </p>
      ) : error ? (
        <div role="alert" className="surface mt-7 p-6">
          <AlertCircle className="h-6 w-6 text-chilli-500" />
          <p className="mt-3">{error}</p>
          <Link href="/menu" className="btn-primary mt-5">
            Open the menu
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-7 space-y-3">
            {rows.map((row) => (
              <li key={row.key} className="surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold">
                      {row.quantity} ×{" "}
                      {row.product?.name ?? row.slug.replace(/-/g, " ")}
                    </h2>
                    <p className="mt-1 text-xs text-charcoal-500">
                      {row.addons
                        .map((a) => `${a.groupName}: ${a.name}`)
                        .join(" · ")}
                    </p>
                  </div>
                  {row.product && !row.error && (
                    <strong>
                      {money(
                        (basePrice(row.product) +
                          row.addons.reduce((n, a) => n + a.price, 0)) *
                          row.quantity,
                      )}
                    </strong>
                  )}
                </div>
                {row.error && (
                  <p role="status" className="mt-2 text-sm text-chilli-600">
                    {row.error} This item will not be added.
                  </p>
                )}
                {row.product && (
                  <Link
                    className="mt-2 inline-block text-xs font-semibold text-chai-700 underline"
                    href={`/menu/${row.product.category.slug}/${row.product.slug}`}
                  >
                    View item
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <div className="surface mt-6 p-5">
            <div className="flex justify-between gap-3">
              <span className="font-semibold">
                Available items · food estimate
              </span>
              <strong>{money(total)}</strong>
            </div>
            <p className="my-3 text-xs leading-relaxed text-charcoal-500">
              Personal notes, addresses, coupons and payment details are never
              shared. Options are checked again; delivery, discounts and tax are
              calculated in your cart.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!ready.length || added || !hydrated}
                onClick={add}
              >
                {added ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <ShoppingBag className="h-4 w-4" />
                )}
                {added
                  ? "Added to your cart"
                  : `Add ${ready.length} ready item${ready.length === 1 ? "" : "s"}`}
              </Button>
              <Link className="btn-secondary" href="/cart">
                Review my cart
              </Link>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied.");
                  } catch {
                    toast.error("Copy this page’s address from your browser.");
                  }
                }}
              >
                <Copy className="h-4 w-4" />
                Copy link
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

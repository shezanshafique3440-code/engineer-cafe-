"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2, ShoppingBag, Tag, X, Loader2, ArrowRight, Truck, Store } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useMoney, useSettings } from "@/context/settings-context";
import { Button, EmptyState, ErrorState } from "@/components/ui";
import { cn } from "@/lib/utils";

export function CartView() {
  const {
    lines, itemCount, quote, quoting, quoteError, couponCode, setCouponCode,
    orderType, setOrderType, increment, decrement, removeItem, clear, hydrated, refreshQuote,
  } = useCart();
  const money = useMoney();
  const settings = useSettings();
  const [couponInput, setCouponInput] = useState(couponCode);

  if (!hydrated) {
    return (
      <div className="container py-16 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-chai-500" aria-label="Loading your cart" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="container py-14 md:py-20">
        <h1 className="mb-8 text-3xl font-extrabold md:text-4xl">Your Cart</h1>
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Your engineering masterpiece needs some Chai."
          description="Nothing in the cart yet. The menu is one tap away."
          actionLabel="Explore Menu"
          actionHref="/menu"
        />
      </div>
    );
  }

  const applyCoupon = () => {
    setCouponCode(couponInput);
    if (couponInput.trim()) toast("Checking your promo code…");
  };

  const removeCoupon = () => {
    setCouponInput("");
    setCouponCode("");
  };

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold md:text-4xl">Your Cart</h1>
          <p className="mt-1.5 text-sm text-charcoal-500">
            {itemCount} item{itemCount === 1 ? "" : "s"} ready to go.
          </p>
        </div>
        <button
          type="button"
          onClick={() => clear()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-chilli-600 hover:underline"
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Clear cart
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <ul className="space-y-3">
          {lines.map((line) => {
            const addonsTotal = line.addons.reduce((s, a) => s + a.price, 0);
            const lineTotal = (line.unitPrice + addonsTotal) * line.quantity;

            return (
              <li key={line.key} className="surface flex gap-3 p-3 sm:gap-4 sm:p-4">
                <Link
                  href={`/menu/${line.slug}`}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream-200 sm:h-24 sm:w-24"
                >
                  {line.image && (
                    <Image src={line.image} alt={line.name} fill sizes="96px" className="object-cover" />
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-charcoal-900 sm:text-base">
                        {line.name}
                      </h2>
                      <p className="text-xs text-charcoal-400">{money(line.unitPrice)} each</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(line.key)}
                      aria-label={`Remove ${line.name} from cart`}
                      className="shrink-0 rounded-lg p-1.5 text-charcoal-300 transition hover:bg-chilli-400/10 hover:text-chilli-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {line.addons.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1">
                      {line.addons.map((addon) => (
                        <li
                          key={addon.id}
                          className="rounded-full bg-cream-100 px-2 py-0.5 text-[11px] text-charcoal-500"
                        >
                          {addon.name}
                          {addon.price > 0 && <span className="ml-1 font-semibold text-chai-600">+{money(addon.price)}</span>}
                        </li>
                      ))}
                    </ul>
                  )}

                  {line.notes && (
                    <p className="mt-1.5 truncate text-[11px] italic text-charcoal-400">“{line.notes}”</p>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                    <div className="flex items-center gap-1 rounded-lg border border-cream-300 p-0.5">
                      <button
                        type="button"
                        onClick={() => decrement(line.key)}
                        className="rounded-md p-1.5 text-charcoal-600 transition hover:bg-cream-100"
                        aria-label={`Decrease quantity of ${line.name}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold" aria-live="polite">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => increment(line.key)}
                        className="rounded-md p-1.5 text-charcoal-600 transition hover:bg-cream-100"
                        aria-label={`Increase quantity of ${line.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-base font-extrabold text-charcoal-900">{money(lineTotal)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-5">
            <h2 className="text-lg font-bold">Order summary</h2>

            <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Order type">
              {([
                ["DELIVERY", "Delivery", Truck],
                ["PICKUP", "Pickup", Store],
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={orderType === value}
                  onClick={() => setOrderType(value)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                    orderType === value
                      ? "border-chai-500 bg-chai-50 text-chai-700"
                      : "border-cream-300 text-charcoal-600 hover:border-chai-300",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-5">
              <label htmlFor="coupon" className="label">Promo code</label>
              <div className="flex gap-2">
                <input
                  id="coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                  placeholder="ENGINEER10"
                  className="field font-mono uppercase"
                />
                <Button variant="secondary" onClick={applyCoupon} className="shrink-0">
                  Apply
                </Button>
              </div>

              {quote?.coupon && (
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-circuit-400/10 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-circuit-600">
                    <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{quote.coupon.code} applied</span>
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="shrink-0 text-xs font-semibold text-charcoal-500 hover:text-chilli-600"
                  >
                    Remove
                  </button>
                </div>
              )}

              {quote?.couponError && (
                <p className="mt-2 text-xs font-medium text-chilli-600" role="alert">
                  {quote.couponError}
                </p>
              )}
            </div>

            <hr className="my-5 border-cream-200" />

            {quoteError ? (
              <ErrorState
                title="Couldn't price your cart."
                description={quoteError}
                onRetry={() => void refreshQuote()}
              />
            ) : (
              <dl className="space-y-2.5 text-sm">
                <Row label="Subtotal" value={money(quote?.subtotal ?? 0)} loading={quoting && !quote} />
                {(quote?.discount ?? 0) > 0 && (
                  <Row
                    label="Discount"
                    value={`− ${money(quote?.discount ?? 0)}`}
                    tone="green"
                  />
                )}
                {orderType === "DELIVERY" && (
                  <Row
                    label="Delivery fee"
                    value={
                      (quote?.deliveryFee ?? 0) === 0 && (quote?.subtotal ?? 0) > 0
                        ? "Free"
                        : money(quote?.deliveryFee ?? settings.deliveryFee)
                    }
                    tone={(quote?.deliveryFee ?? 1) === 0 ? "green" : undefined}
                  />
                )}
                {(quote?.tax ?? 0) > 0 && (
                  <Row label={`Tax (${settings.taxPercent}%)`} value={money(quote?.tax ?? 0)} />
                )}
                <div className="flex items-center justify-between border-t border-cream-200 pt-3 text-base">
                  <dt className="font-bold text-charcoal-900">Grand Total</dt>
                  <dd className="flex items-center gap-2 font-extrabold text-charcoal-900">
                    {quoting && <Loader2 className="h-3.5 w-3.5 animate-spin text-chai-500" aria-hidden />}
                    {money(quote?.total ?? 0)}
                  </dd>
                </div>
              </dl>
            )}

            {quote?.belowMinimum && (
              <p className="mt-4 rounded-lg bg-chai-50 px-3 py-2.5 text-xs font-medium text-chai-800" role="alert">
                Minimum order is {money(quote.minOrderAmount)}. Add{" "}
                {money(quote.minOrderAmount - quote.subtotal)} more to check out.
              </p>
            )}

            {orderType === "DELIVERY" &&
              settings.freeDeliveryOver &&
              quote &&
              quote.deliveryFee > 0 && (
                <p className="mt-3 text-xs text-charcoal-500">
                  Add {money(settings.freeDeliveryOver - (quote.subtotal - quote.discount))} more for free delivery.
                </p>
              )}

            <Link
              href="/checkout"
              aria-disabled={quote?.belowMinimum || !quote}
              className={cn(
                "btn-primary mt-5 w-full",
                (quote?.belowMinimum || !quote) && "pointer-events-none opacity-50",
              )}
            >
              Proceed to Checkout
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>

            <Link href="/menu" className="btn-ghost mt-2 w-full">
              Continue shopping
            </Link>

            <p className="mt-4 text-center font-mono text-[11px] text-charcoal-300">
              {"// totals verified server-side at checkout"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: string;
  tone?: "green";
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-charcoal-500">{label}</dt>
      <dd className={cn("font-semibold", tone === "green" ? "text-circuit-600" : "text-charcoal-800")}>
        {loading ? <span className="skeleton inline-block h-4 w-16 align-middle" /> : value}
      </dd>
    </div>
  );
}

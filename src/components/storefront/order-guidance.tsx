"use client";
import Link from "next/link";
import { Truck, Store, Check, ShieldCheck } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useMoney, useSettings } from "@/context/settings-context";
import { cartMilestones } from "@/lib/storefront";
import { cn } from "@/lib/utils";
export function ServiceChoice() {
  const { orderType, setOrderType } = useCart();
  const s = useSettings();
  return (
    <section className="container py-5">
      <div className="surface flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div>
          <p className="text-sm font-bold">Make this your kind of break.</p>
          <p className="mt-1 text-xs text-charcoal-500">
            Choose how you’ll enjoy it. Your cart updates with your service
            choice.
          </p>
        </div>
        <div className="flex gap-2" aria-label="Choose service type">
          {[
            {
              type: "DELIVERY" as const,
              label: "Delivery",
              icon: Truck,
              enabled: s.codEnabled || s.onlinePaymentEnabled,
            },
            {
              type: "PICKUP" as const,
              label: "Pickup",
              icon: Store,
              enabled: s.cashAtCounterEnabled || s.onlinePaymentEnabled,
            },
          ].map((option) => (
            <button
              key={option.type}
              type="button"
              disabled={!option.enabled}
              aria-pressed={orderType === option.type}
              onClick={() => setOrderType(option.type)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-40",
                orderType === option.type
                  ? "border-chai-500 bg-chai-100 text-chai-800"
                  : "border-cream-200 bg-surface",
              )}
            >
              <option.icon className="h-4 w-4" />
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
export function CartGuidance() {
  const { quote, quoting, orderType } = useCart();
  const s = useSettings();
  const money = useMoney();
  if (!quote) return null;
  if (quoting)
    return (
      <p role="status" className="my-4 text-xs text-charcoal-500">
        Refreshing your order milestones…
      </p>
    );
  const state = cartMilestones(
    quote.subtotal,
    quote.discount,
    quote.minOrderAmount,
    s.freeDeliveryOver,
  );
  return (
    <div className="my-5 space-y-4 rounded-2xl border border-cream-200 bg-cream-50 p-4">
      <div>
        <p className="flex items-start gap-2 text-xs font-semibold">
          <ShieldCheck className="h-4 w-4 shrink-0 text-chai-600" />
          {state.minimumRemaining
            ? `${money(state.minimumRemaining)} more to reach the cafe minimum.`
            : "Cafe minimum reached. You’re ready to review checkout."}
        </p>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-200"
          role="progressbar"
          aria-label="Cafe minimum progress"
          aria-valuenow={Math.round(state.minimumProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-chai-500 transition-all"
            style={{ width: `${state.minimumProgress}%` }}
          />
        </div>
      </div>
      {orderType === "DELIVERY" && state.freeRemaining !== null && (
        <div>
          <p className="flex items-start gap-2 text-xs font-semibold">
            {state.freeRemaining === 0 ? (
              <Check className="h-4 w-4 shrink-0 text-circuit-600" />
            ) : (
              <Truck className="h-4 w-4 shrink-0 text-chai-600" />
            )}
            {state.freeRemaining === 0
              ? "Your order qualifies for free delivery."
              : `${money(state.freeRemaining)} more in food after discounts for free delivery.`}
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-200"
            role="progressbar"
            aria-label="Free delivery progress"
            aria-valuenow={Math.round(state.freeProgress ?? 0)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-circuit-500 transition-all"
              style={{ width: `${state.freeProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function ServiceRibbon() {
  const settings = useSettings();
  const { isAcceptingOrders, minOrderAmount } = settings;
  const money = useMoney();
  return (
    <div className="border-b border-cream-200 bg-surface">
      <div className="container flex flex-wrap items-center justify-between gap-x-5 gap-y-2 py-3 text-xs">
        <span className="inline-flex items-center gap-2 font-semibold">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isAcceptingOrders ? "bg-circuit-500" : "bg-chilli-500",
            )}
            aria-hidden
          />
          {isAcceptingOrders
            ? "Accepting online orders"
            : "Online ordering is paused"}
        </span>
        <span className="text-charcoal-500">
          Made to order · Minimum {money(minOrderAmount)}
        </span>
        <Link href="/contact" className="font-semibold text-chai-700">
          Questions? Talk to the cafe →
        </Link>
      </div>
    </div>
  );
}

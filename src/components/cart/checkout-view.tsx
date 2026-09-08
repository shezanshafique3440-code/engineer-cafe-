"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Truck, Store, Banknote, CreditCard, Wallet, MapPin, Loader2 } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { useCart } from "@/context/cart-context";
import { useSession } from "@/context/session-context";
import { useMoney, useSettings } from "@/context/settings-context";
import { Button, Input, Textarea, Checkbox, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import type { OrderDTO } from "@/server/orders";

type Address = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine: string;
  area: string | null;
  city: string;
  isDefault: boolean;
};

type PaymentMethod = "CASH_ON_DELIVERY" | "CASH_AT_COUNTER" | "ONLINE";

export function CheckoutView() {
  const router = useRouter();
  const { user } = useSession();
  const settings = useSettings();
  const money = useMoney();
  const { lines, quote, quoting, orderType, setOrderType, couponCode, toCartLinesPayload, clear, hydrated } = useCart();

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    addressLine: "",
    area: "",
    city: settings.city,
    instructions: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH_ON_DELIVERY");
  const [saveAddress, setSaveAddress] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  // Prefill from the signed-in profile and their default saved address.
  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      customerName: current.customerName || user.name,
      customerEmail: current.customerEmail || user.email,
    }));

    void apiGet<{ addresses: Address[] }>("/api/addresses")
      .then((data) => {
        setAddresses(data.addresses);
        const preferred = data.addresses.find((a) => a.isDefault) ?? data.addresses[0];
        if (preferred) applyAddress(preferred);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    // Pickup orders can't be paid on delivery.
    if (orderType === "PICKUP" && paymentMethod === "CASH_ON_DELIVERY") {
      setPaymentMethod(settings.cashAtCounterEnabled ? "CASH_AT_COUNTER" : "ONLINE");
    }
    if (orderType === "DELIVERY" && paymentMethod === "CASH_AT_COUNTER") {
      setPaymentMethod(settings.codEnabled ? "CASH_ON_DELIVERY" : "ONLINE");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderType]);

  const applyAddress = (address: Address) => {
    setForm((current) => ({
      ...current,
      customerName: address.fullName,
      customerPhone: address.phone,
      addressLine: address.addressLine,
      area: address.area ?? "",
      city: address.city,
    }));
  };

  const set = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: [] }));
  };

  const paymentOptions = [
    { value: "CASH_ON_DELIVERY" as const, icon: Banknote, enabled: settings.codEnabled && orderType === "DELIVERY", hint: "Pay the rider when your order arrives." },
    { value: "CASH_AT_COUNTER" as const, icon: Wallet, enabled: settings.cashAtCounterEnabled && orderType === "PICKUP", hint: "Pay at the cafe counter when you collect." },
    { value: "ONLINE" as const, icon: CreditCard, enabled: settings.onlinePaymentEnabled, hint: "Card and wallet payments." },
  ].filter((option) => option.enabled);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      const data = await apiPost<{ order: OrderDTO }>("/api/orders", {
        lines: toCartLinesPayload(),
        couponCode: couponCode || undefined,
        orderType,
        paymentMethod,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        addressLine: form.addressLine || undefined,
        area: form.area || undefined,
        city: form.city || undefined,
        instructions: form.instructions || undefined,
        saveAddress: saveAddress && Boolean(user),
      });

      clear({ silent: true });
      toast.success(`Order ${data.order.orderNumber} placed!`);
      router.push(`/orders/${data.order.orderNumber}?placed=1`);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error("Couldn't place your order. Please try again.");
      }
      setSubmitting(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="container py-16 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-chai-500" aria-label="Loading" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="container py-14 md:py-20">
        <h1 className="mb-8 text-3xl font-extrabold">Checkout</h1>
        <EmptyState
          icon={<Truck className="h-6 w-6" />}
          title="Your cart is empty."
          description="Add a few items before checking out."
          actionLabel="Explore Menu"
          actionHref="/menu"
        />
      </div>
    );
  }

  if (!settings.isAcceptingOrders) {
    return (
      <div className="container py-14 md:py-20">
        <EmptyState
          title="We're not taking orders right now."
          description={`The kitchen is closed. Opening hours: ${settings.openingHours}.`}
          actionLabel="Back to menu"
          actionHref="/menu"
        />
      </div>
    );
  }

  return (
    <div className="container py-8 md:py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">Checkout</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        One more step and the tawa gets going.
      </p>

      <form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-5">
          <section className="surface p-5" aria-labelledby="order-type-heading">
            <h2 id="order-type-heading" className="mb-4 text-lg font-bold">How would you like it?</h2>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="order-type-heading">
              {([
                ["DELIVERY", "Delivery", Truck, `Delivered to your door · ${money(settings.deliveryFee)}`],
                ["PICKUP", "Pickup", Store, `Pickup from ${settings.cafeName}`],
              ] as const).map(([value, label, Icon, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={orderType === value}
                  onClick={() => setOrderType(value)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                    orderType === value
                      ? "border-chai-500 bg-chai-50"
                      : "border-cream-200 bg-white hover:border-chai-300",
                  )}
                >
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", orderType === value ? "text-chai-600" : "text-charcoal-400")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-charcoal-900">{label}</span>
                    <span className="block text-xs text-charcoal-500">{hint}</span>
                  </span>
                </button>
              ))}
            </div>

            {orderType === "PICKUP" && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-cream-100 p-4">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-chai-600" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-charcoal-900">Pickup from {settings.cafeName}</p>
                  <p className="mt-0.5 text-xs text-charcoal-600">{settings.address}</p>
                  <p className="mt-0.5 text-xs text-charcoal-400">{settings.openingHours}</p>
                </div>
              </div>
            )}
          </section>

          <section className="surface p-5" aria-labelledby="contact-heading">
            <h2 id="contact-heading" className="mb-4 text-lg font-bold">Your details</h2>

            {addresses.length > 0 && orderType === "DELIVERY" && (
              <div className="mb-5">
                <span className="label">Saved addresses</span>
                <div className="flex flex-wrap gap-2">
                  {addresses.map((address) => (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => applyAddress(address)}
                      className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-medium text-charcoal-600 transition hover:border-chai-400 hover:text-chai-700"
                    >
                      {address.label} · {address.area ?? address.city}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                name="customerName"
                value={form.customerName}
                onChange={(e) => set("customerName", e.target.value)}
                error={errors.customerName?.[0]}
                autoComplete="name"
                required
              />
              <Input
                label="Phone number"
                name="customerPhone"
                type="tel"
                inputMode="tel"
                value={form.customerPhone}
                onChange={(e) => set("customerPhone", e.target.value)}
                error={errors.customerPhone?.[0]}
                placeholder="03001234567"
                autoComplete="tel"
                required
              />
              <div className="sm:col-span-2">
                <Input
                  label="Email (optional)"
                  name="customerEmail"
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => set("customerEmail", e.target.value)}
                  error={errors.customerEmail?.[0]}
                  autoComplete="email"
                  hint="We'll send your order confirmation here."
                />
              </div>
            </div>

            {orderType === "DELIVERY" && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Textarea
                    label="Delivery address"
                    name="addressLine"
                    rows={2}
                    value={form.addressLine}
                    onChange={(e) => set("addressLine", e.target.value)}
                    error={errors.addressLine?.[0]}
                    placeholder="House / flat number, street, landmark"
                    autoComplete="street-address"
                    required
                  />
                </div>
                <Input
                  label="Area"
                  name="area"
                  value={form.area}
                  onChange={(e) => set("area", e.target.value)}
                  error={errors.area?.[0]}
                  placeholder="Gulberg III"
                />
                <Input
                  label="City"
                  name="city"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  error={errors.city?.[0]}
                  autoComplete="address-level2"
                  required
                />
              </div>
            )}

            <div className="mt-4">
              <Textarea
                label="Special instructions (optional)"
                name="instructions"
                rows={2}
                value={form.instructions}
                onChange={(e) => set("instructions", e.target.value)}
                error={errors.instructions?.[0]}
                placeholder="Ring the bell twice, less spicy, etc."
              />
            </div>

            {user && orderType === "DELIVERY" && (
              <div className="mt-4">
                <Checkbox
                  name="saveAddress"
                  label="Save this address to my account"
                  description="So your next order is one tap faster."
                  checked={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.checked)}
                />
              </div>
            )}

            {!user && (
              <p className="mt-4 rounded-lg bg-cream-100 px-3.5 py-3 text-xs text-charcoal-600">
                Ordering as a guest.{" "}
                <Link href="/login?next=/checkout" className="font-semibold text-chai-700 hover:underline">
                  Login
                </Link>{" "}
                to track orders and reorder in one tap.
              </p>
            )}
          </section>

          <section className="surface p-5" aria-labelledby="payment-heading">
            <h2 id="payment-heading" className="mb-4 text-lg font-bold">Payment method</h2>
            <div className="space-y-2.5" role="radiogroup" aria-labelledby="payment-heading">
              {paymentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === option.value}
                  onClick={() => setPaymentMethod(option.value)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
                    paymentMethod === option.value
                      ? "border-chai-500 bg-chai-50"
                      : "border-cream-200 bg-white hover:border-chai-300",
                  )}
                >
                  <option.icon
                    className={cn("mt-0.5 h-5 w-5 shrink-0", paymentMethod === option.value ? "text-chai-600" : "text-charcoal-400")}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-charcoal-900">
                      {PAYMENT_METHOD_LABEL[option.value]}
                    </span>
                    <span className="block text-xs text-charcoal-500">{option.hint}</span>
                  </span>
                </button>
              ))}
              {paymentOptions.length === 0 && (
                <p className="text-sm text-chilli-600">
                  No payment method is available for this order type right now.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-5">
            <h2 className="text-lg font-bold">Order summary</h2>

            <ul className="mt-4 max-h-[280px] space-y-3 overflow-y-auto pr-1">
              {lines.map((line) => {
                const addonsTotal = line.addons.reduce((s, a) => s + a.price, 0);
                return (
                  <li key={line.key} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium text-charcoal-800">
                        {line.quantity} × {line.name}
                      </span>
                      {line.addons.length > 0 && (
                        <span className="block text-xs text-charcoal-400">
                          {line.addons.map((a) => a.name).join(", ")}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold text-charcoal-700">
                      {money((line.unitPrice + addonsTotal) * line.quantity)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <hr className="my-4 border-cream-200" />

            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-charcoal-500">Subtotal</dt>
                <dd className="font-semibold">{money(quote?.subtotal ?? 0)}</dd>
              </div>
              {(quote?.discount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-charcoal-500">Discount {quote?.coupon ? `(${quote.coupon.code})` : ""}</dt>
                  <dd className="font-semibold text-circuit-600">− {money(quote?.discount ?? 0)}</dd>
                </div>
              )}
              {orderType === "DELIVERY" && (
                <div className="flex justify-between">
                  <dt className="text-charcoal-500">Delivery fee</dt>
                  <dd className="font-semibold">
                    {(quote?.deliveryFee ?? 0) === 0 ? "Free" : money(quote?.deliveryFee ?? 0)}
                  </dd>
                </div>
              )}
              {(quote?.tax ?? 0) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-charcoal-500">Tax</dt>
                  <dd className="font-semibold">{money(quote?.tax ?? 0)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-cream-200 pt-3 text-base">
                <dt className="font-bold">Grand Total</dt>
                <dd className="flex items-center gap-2 font-extrabold">
                  {quoting && <Loader2 className="h-3.5 w-3.5 animate-spin text-chai-500" aria-hidden />}
                  {money(quote?.total ?? 0)}
                </dd>
              </div>
            </dl>

            {quote && quote.estimatedMinutes > 0 && (
              <p className="mt-4 rounded-lg bg-cream-100 px-3 py-2.5 text-xs text-charcoal-600">
                Estimated {orderType === "DELIVERY" ? "delivery" : "pickup"} time:{" "}
                <strong className="text-charcoal-900">~{quote.estimatedMinutes} minutes</strong>
              </p>
            )}

            {quote?.belowMinimum && (
              <p className="mt-3 rounded-lg bg-chai-50 px-3 py-2.5 text-xs font-medium text-chai-800" role="alert">
                Minimum order is {money(quote.minOrderAmount)}.
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="mt-5 w-full"
              loading={submitting}
              disabled={quoting || quote?.belowMinimum || paymentOptions.length === 0}
            >
              Place Order · {money(quote?.total ?? 0)}
            </Button>

            <p className="mt-3 text-center text-[11px] leading-snug text-charcoal-400">
              By placing this order you agree to our order and refund policy. All totals are
              recalculated and verified on our server.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}

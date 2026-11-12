"use client";

import { scheduleError, pakistanTime } from "@/lib/experience";
import { checkoutSchema } from "@/lib/validation";
import { useLanguage, T } from "@/context/language-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Truck,
  Store,
  Banknote,
  CreditCard,
  Wallet,
  MapPin,
  Loader2,
} from "lucide-react";
import {
  readSaleIntent,
  saveSaleIntent,
  clearSaleIntent,
  definiteRejection,
  type SaleIntent,
} from "@/lib/sale-intent";
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
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useSession();
  const settings = useSettings();
  const money = useMoney();
  const {
    lines,
    quote,
    quoting,
    orderType,
    setOrderType,
    couponCode,
    toCartLinesPayload,
    clear,
    hydrated,
    redeemReward,
    setRedeemReward,
    quoteError,
    refreshQuote,
  } = useCart();

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    addressLine: "",
    area: "",
    city: settings.city,
    instructions: "",
  });
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("CASH_ON_DELIVERY");
  const [saveAddress, setSaveAddress] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [step, setStep] = useState(1);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [requestId, setRequestId] = useState("");
  const intentKey = `cafe-checkout-intent:${user?.id || "guest"}`;
  const [pendingIntent, setPendingIntent] = useState<SaleIntent | null>(null);
  const [balance, setBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const prior = readSaleIntent(intentKey, user?.id || "guest");
      setPendingIntent(prior);
      setRequestId(
        prior ? String(prior.payload.requestId) : crypto.randomUUID(),
      );
    } catch {
      toast.error("Enable browser storage before placing an order safely.");
    }
  }, [intentKey, user?.id]);
  useEffect(() => {
    if (user)
      void apiGet<{ balance: number }>("/api/loyalty")
        .then((d) => setBalance(d.balance))
        .catch(() => undefined);
    else {
      setBalance(0);
      setRedeemReward(false);
    }
  }, [user, setRedeemReward]);
  const selectedDate =
    scheduled && scheduledLocal ? new Date(`${scheduledLocal}:00+05:00`) : null;
  const scheduledAt =
    selectedDate && Number.isFinite(selectedDate.getTime())
      ? selectedDate.toISOString()
      : null;
  const payload = () => ({
    requestId,
    expectedTotal: quote?.total,
    lines: toCartLinesPayload(),
    couponCode: couponCode || undefined,
    orderType,
    paymentMethod,
    ...form,
    customerEmail: form.customerEmail || undefined,
    scheduledAt,
    redeemReward,
    saveAddress: saveAddress && Boolean(user),
  });
  const review = () => {
    const parsed = checkoutSchema.safeParse(payload());
    const fields = parsed.success ? {} : parsed.error.flatten().fieldErrors;
    const timeError =
      scheduled && !scheduledAt
        ? "Choose your scheduled time."
        : scheduleError(scheduledAt, settings);
    if (!parsed.success || timeError) {
      setErrors({
        ...fields,
        ...(timeError ? { scheduledAt: [timeError] } : {}),
      });
      toast.error(t("Please check the highlighted fields."));
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setErrors({});
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
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
        const preferred =
          data.addresses.find((a) => a.isDefault) ?? data.addresses[0];
        if (preferred) applyAddress(preferred);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    // Pickup orders can't be paid on delivery.
    if (orderType === "PICKUP" && paymentMethod === "CASH_ON_DELIVERY") {
      setPaymentMethod(
        settings.cashAtCounterEnabled ? "CASH_AT_COUNTER" : "ONLINE",
      );
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
    {
      value: "CASH_ON_DELIVERY" as const,
      icon: Banknote,
      enabled: settings.codEnabled && orderType === "DELIVERY",
      hint: "Pay the rider when your order arrives.",
    },
    {
      value: "CASH_AT_COUNTER" as const,
      icon: Wallet,
      enabled: settings.cashAtCounterEnabled && orderType === "PICKUP",
      hint: "Pay at the cafe counter when you collect.",
    },
    {
      value: "ONLINE" as const,
      icon: CreditCard,
      enabled: settings.onlinePaymentEnabled,
      hint: "Card and wallet payments.",
    },
  ].filter((option) => option.enabled);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step === 1 && !pendingIntent) {
      review();
      return;
    }
    if (!pendingIntent && (!quote || quoting || quoteError)) return;
    setErrors({});
    setSubmitting(true);

    try {
      const intent = pendingIntent ?? {
        ownerId: user?.id || "guest",
        endpoint: "/api/orders",
        payload: payload(),
        createdAt: new Date().toISOString(),
      };
      saveSaleIntent(intentKey, intent);
      setPendingIntent(intent);
      const data = await apiPost<{ order: OrderDTO }>(
        intent.endpoint,
        intent.payload,
      );
      if (!data?.order?.id)
        throw new Error("No server confirmation. Retry your original order.");
      clearSaleIntent(intentKey);
      setPendingIntent(null);

      clear({ silent: true });
      toast.success(`Order ${data.order.orderNumber} placed!`);
      router.push(`${data.order.trackingPath}&placed=1`);
    } catch (error) {
      if (error instanceof ApiError && definiteRejection(error.status)) {
        clearSaleIntent(intentKey);
        setPendingIntent(null);
      }
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(t(error.message));
        if (error.fields) setStep(1);
        void refreshQuote();
      } else {
        toast.error("Couldn't place your order. Please try again.");
      }
      setSubmitting(false);
    }
  };

  if (pendingIntent)
    return (
      <section className="container py-16 space-y-4" aria-live="polite">
        <h1 className="text-2xl font-bold">Check your last order</h1>
        <p>
          The connection ended before confirmation. Retry checks the same order
          ID; your original order details are preserved.
        </p>
        <Button
          loading={submitting}
          onClick={() =>
            void submit({ preventDefault() {} } as React.FormEvent)
          }
        >
          Recover original order
        </Button>
      </section>
    );
  if (!hydrated) {
    return (
      <div className="container py-16 text-center">
        <Loader2
          className="mx-auto h-6 w-6 animate-spin text-chai-500"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="container py-14 md:py-20">
        <h1 className="mb-8 text-3xl font-extrabold">
          {<T text="Checkout" />}
        </h1>
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
    <div className="container pb-44 pt-8 md:py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">
        {<T text="Checkout" />}
      </h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        {<T text="Fresh food, a few simple details." />}
      </p>

      <ol
        className="mt-5 flex gap-3 text-sm"
        aria-label={t("Checkout progress")}
      >
        {[t("1 · Your details"), t("2 · Review & pay")].map((label, i) => (
          <li
            key={label}
            aria-current={step === i + 1 ? "step" : undefined}
            className={cn(
              "rounded-full border px-4 py-2",
              step === i + 1
                ? "border-chai-500 bg-chai-50 font-bold"
                : "border-cream-200 text-charcoal-500",
            )}
          >
            {<T text={label} />}
          </li>
        ))}
      </ol>
      <form
        noValidate
        onSubmit={submit}
        className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8"
      >
        <div className="space-y-5">
          <div hidden={step !== 1} className="space-y-5">
            <section
              className="surface p-5"
              aria-labelledby="order-type-heading"
            >
              <h2 id="order-type-heading" className="mb-4 text-lg font-bold">
                {<T text="How would you like it?" />}
              </h2>
              <div
                className="grid gap-3 sm:grid-cols-2"
                role="radiogroup"
                aria-labelledby="order-type-heading"
              >
                {(
                  [
                    [
                      "DELIVERY",
                      "Delivery",
                      Truck,
                      `Delivered to your door · ${money(settings.deliveryFee)}`,
                    ],
                    [
                      "PICKUP",
                      "Pickup",
                      Store,
                      `Pickup from ${settings.cafeName}`,
                    ],
                  ] as const
                ).map(([value, label, Icon, hint]) => (
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
                        : "border-cream-200 bg-surface hover:border-chai-300",
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 h-5 w-5 shrink-0",
                        orderType === value
                          ? "text-chai-600"
                          : "text-charcoal-400",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-charcoal-900">
                        {<T text={label} />}
                      </span>
                      <span className="block text-xs text-charcoal-500">
                        {<T text={hint} />}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {orderType === "PICKUP" && (
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-cream-100 p-4">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0 text-chai-600"
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-bold text-charcoal-900">
                      {<T text="Pickup from" />}
                      {settings.cafeName}
                    </p>
                    <p className="mt-0.5 text-xs text-charcoal-600">
                      {settings.address}
                    </p>
                    <p className="mt-0.5 text-xs text-charcoal-400">
                      {settings.openingHours}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="surface p-5" aria-labelledby="contact-heading">
              <h2 id="contact-heading" className="mb-4 text-lg font-bold">
                {<T text="Your details" />}
              </h2>

              {addresses.length > 0 && orderType === "DELIVERY" && (
                <div className="mb-5">
                  <span className="label">{<T text="Saved addresses" />}</span>
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
                    hint="Optional, for your order details."
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
                    placeholder="Chatta Bakhtawar"
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
                  {<T text="Ordering as a guest." />}{" "}
                  <Link
                    href="/login?next=/checkout"
                    className="font-semibold text-chai-700 hover:underline"
                  >
                    {<T text="Login" />}
                  </Link>{" "}
                  {<T text="to track orders and reorder in one tap." />}
                </p>
              )}
            </section>

            <section className="surface p-5">
              <h2 className="text-lg font-bold">
                <T text="When would you like it?" />
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={!scheduled ? "primary" : "secondary"}
                  onClick={() => setScheduled(false)}
                >
                  <T text="As soon as possible" />
                </Button>
                {settings.schedulingEnabled && (
                  <Button
                    type="button"
                    variant={scheduled ? "primary" : "secondary"}
                    onClick={() => setScheduled(true)}
                  >
                    <T text="Schedule for later" />
                  </Button>
                )}
              </div>
              {scheduled && (
                <div className="mt-4">
                  <Input
                    type="datetime-local"
                    label="Date & time (Pakistan)"
                    value={scheduledLocal}
                    error={errors.scheduledAt?.[0]}
                    onChange={(e) => setScheduledLocal(e.target.value)}
                    required
                  />
                  <p className="mt-2 text-xs text-charcoal-500">
                    {t("Schedule up to")} {settings.scheduleDaysAhead}{" "}
                    {t("days ahead. Minimum notice:")}{" "}
                    {settings.scheduleLeadMinutes} {t("minutes")}.
                  </p>
                </div>
              )}
            </section>
          </div>
          {step === 2 && (
            <section className="surface p-5">
              <div className="flex justify-between gap-3">
                <h2 className="text-lg font-bold">
                  <T text="Review your details" />
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                >
                  <T text="Edit" />
                </Button>
              </div>
              <p className="mt-3">
                {form.customerName} · <bdi>{form.customerPhone}</bdi>
              </p>
              <p className="mt-1 text-sm text-charcoal-500">
                {orderType === "DELIVERY"
                  ? [form.addressLine, form.area, form.city]
                      .filter(Boolean)
                      .join(", ")
                  : settings.address}
              </p>
              <p className="mt-3 text-sm font-semibold">
                {scheduledAt
                  ? pakistanTime(scheduledAt)
                  : t("As soon as possible")}
              </p>
            </section>
          )}
          <section
            hidden={step !== 2}
            className="surface p-5"
            aria-labelledby="payment-heading"
          >
            <h2 id="payment-heading" className="mb-4 text-lg font-bold">
              {<T text="Payment method" />}
            </h2>
            <div
              className="space-y-2.5"
              role="radiogroup"
              aria-labelledby="payment-heading"
            >
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
                      : "border-cream-200 bg-surface hover:border-chai-300",
                  )}
                >
                  <option.icon
                    className={cn(
                      "mt-0.5 h-5 w-5 shrink-0",
                      paymentMethod === option.value
                        ? "text-chai-600"
                        : "text-charcoal-400",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-charcoal-900">
                      {<T text={PAYMENT_METHOD_LABEL[option.value]} />}
                    </span>
                    <span className="block text-xs text-charcoal-500">
                      {<T text={option.hint} />}
                    </span>
                  </span>
                </button>
              ))}
              {paymentOptions.length === 0 && (
                <p className="text-sm text-chilli-600">
                  {
                    <T text="No payment method is available for this order type right now." />
                  }
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-5">
            <h2 className="text-lg font-bold">{<T text="Order summary" />}</h2>

            <ul className="mt-4 max-h-[280px] space-y-3 overflow-y-auto pr-1">
              {lines.map((line) => {
                const addonsTotal = line.addons.reduce(
                  (s, a) => s + a.price,
                  0,
                );
                return (
                  <li
                    key={line.key}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-charcoal-800">
                        {line.quantity} × {<T text={line.name} />}
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
                <dt className="text-charcoal-500">{<T text="Subtotal" />}</dt>
                <dd className="font-semibold">
                  {quote ? money(quote.subtotal) : "—"}
                </dd>
              </div>
              {(quote?.discount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-charcoal-500">
                    {<T text="Discount" />}
                    {quote?.coupon ? `(${quote.coupon.code})` : ""}
                  </dt>
                  <dd className="font-semibold text-circuit-600">
                    − {money(quote?.discount ?? 0)}
                  </dd>
                </div>
              )}
              {orderType === "DELIVERY" && (
                <div className="flex justify-between">
                  <dt className="text-charcoal-500">
                    {<T text="Delivery fee" />}
                  </dt>
                  <dd className="font-semibold">
                    {(quote?.deliveryFee ?? 0) === 0
                      ? "Free"
                      : money(quote?.deliveryFee ?? 0)}
                  </dd>
                </div>
              )}
              {(quote?.tax ?? 0) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-charcoal-500">{<T text="Tax" />}</dt>
                  <dd className="font-semibold">{money(quote?.tax ?? 0)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-cream-200 pt-3 text-base">
                <dt className="font-bold">{<T text="Grand Total" />}</dt>
                <dd className="flex items-center gap-2 font-extrabold">
                  {quoting && (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin text-chai-500"
                      aria-hidden
                    />
                  )}
                  {quote ? money(quote.total) : "—"}
                </dd>
              </div>
            </dl>

            {quote && quote.estimatedMinutes > 0 && (
              <p className="mt-4 rounded-lg bg-cream-100 px-3 py-2.5 text-xs text-charcoal-600">
                {<T text="Estimated" />}
                {orderType === "DELIVERY" ? "delivery" : "pickup"}{" "}
                {<T text="time:" />}{" "}
                <strong className="text-charcoal-900">
                  ~{quote.estimatedMinutes} {<T text="minutes" />}
                </strong>
              </p>
            )}

            {quote?.belowMinimum && (
              <p
                className="mt-3 rounded-lg bg-chai-50 px-3 py-2.5 text-xs font-medium text-chai-800"
                role="alert"
              >
                {<T text="Minimum order is" />}
                {money(quote.minOrderAmount)}.
              </p>
            )}

            {settings.loyaltyEnabled && user && (
              <div className="mt-4 rounded-xl bg-chai-50 p-3">
                <Checkbox
                  name="redeemReward"
                  label={`${t("Use")} ${settings.loyaltyRewardPoints} ${t("points for")} ${money(settings.loyaltyRewardValue)} ${t("off")}`}
                  description={`${t("Your balance")}: ${balance} ${t("points")}`}
                  checked={redeemReward}
                  disabled={balance < settings.loyaltyRewardPoints}
                  onChange={(e) => setRedeemReward(e.target.checked)}
                />
              </div>
            )}
            {!!quote?.loyaltyDiscount && (
              <p className="mt-3 text-sm text-circuit-600">
                {t("Loyalty reward")}: −{money(quote.loyaltyDiscount)}
              </p>
            )}
            {quoteError && (
              <p role="alert" className="mt-3 text-sm text-chilli-600">
                {t(quoteError)}{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void refreshQuote()}
                >
                  {t("Try again")}
                </button>
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              className="mt-5 w-full"
              loading={submitting}
              disabled={
                !quote ||
                quoting ||
                quote.belowMinimum ||
                paymentOptions.length === 0 ||
                !requestId
              }
            >
              {step === 1 ? t("Continue to review") : t("Place Order")} ·{" "}
              {quote ? money(quote.total) : "—"}
            </Button>

            <p className="mt-3 text-center text-[11px] leading-snug text-charcoal-400">
              {
                <T text="By placing this order, you agree to the cafe’s order and refund policy." />
              }
            </p>
          </div>
        </div>
      </form>
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 border-t border-cream-200 bg-surface/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div>
          <p className="text-xs text-charcoal-500">
            <T text="Grand Total" />
          </p>
          <strong>
            {quoting ? t("Updating…") : quote ? money(quote.total) : "—"}
          </strong>
        </div>
        <Button
          type="button"
          loading={submitting}
          disabled={
            !quote || quoting || quote.belowMinimum || !paymentOptions.length
          }
          onClick={() => {
            if (step === 1) review();
            else
              document.querySelector<HTMLFormElement>("form")?.requestSubmit();
          }}
        >
          {step === 1 ? t("Review order") : t("Place Order")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, Clock, MapPin, Phone, Printer, RefreshCw, ShoppingBag, XCircle, Store } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { useMoney, useSettings } from "@/context/settings-context";
import { useCart } from "@/context/cart-context";
import { Badge, Button } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, ORDER_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import type { OrderDTO } from "@/server/orders";

export function OrderTracker({ initialOrder }: { initialOrder: OrderDTO }) {
  const [order, setOrder] = useState(initialOrder);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const searchParams = useSearchParams();
  const justPlaced = searchParams.get("placed") === "1";
  const money = useMoney();
  const settings = useSettings();
  const { addItem } = useCart();

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await apiGet<{ order: OrderDTO }>(`/api/orders/${order.orderNumber}`);
      setOrder(data.order);
    } catch {
      toast.error("Couldn't refresh this order.");
    } finally {
      setRefreshing(false);
    }
  }, [order.orderNumber]);

  // Poll while the order is still live so the customer sees status changes.
  useEffect(() => {
    if (["DELIVERED", "CANCELLED"].includes(order.status)) return;
    const timer = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(timer);
  }, [order.status, refresh]);

  const flow = ["PENDING", "CONFIRMED", "PREPARING", "READY", ...(order.orderType === "DELIVERY" ? ["OUT_FOR_DELIVERY"] : []), "DELIVERED"];
  const currentIndex = flow.indexOf(order.status);
  const cancelled = order.status === "CANCELLED";
  const canCancel = ["PENDING", "CONFIRMED"].includes(order.status);

  const cancel = async () => {
    if (!window.confirm("Cancel this order? This can't be undone.")) return;
    setCancelling(true);
    try {
      const data = await apiPost<{ order: OrderDTO }>(`/api/orders/${order.orderNumber}/cancel`);
      setOrder(data.order);
      toast.success("Your order has been cancelled.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't cancel this order.");
    } finally {
      setCancelling(false);
    }
  };

  const reorder = () => {
    for (const item of order.items) {
      if (!item.productId) continue;
      addItem(
        {
          id: item.productId,
          name: item.productName,
          slug: item.productSlug,
          image: item.productImage,
          price: item.unitPrice,
          discountPrice: null,
        },
        {
          quantity: item.quantity,
          addons: item.addons.map((a) => ({
            id: a.addonId ?? a.id,
            name: a.addonName,
            price: a.price,
            groupName: a.groupName,
          })),
          notes: item.notes ?? undefined,
          silent: true,
        },
      );
    }
    toast.success("Items added to your cart");
  };

  return (
    <div className="container py-8 md:py-12">
      {justPlaced && !cancelled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-circuit-400/40 bg-circuit-400/10 p-6 text-center"
        >
          <span className="text-4xl" aria-hidden>☕</span>
          <h1 className="mt-3 text-2xl font-extrabold text-charcoal-900 md:text-3xl">
            Order Confirmed!
          </h1>
          <p className="mt-2 text-sm text-charcoal-600">
            Thanks {order.customerName.split(" ")[0]} — the kitchen has your order.
          </p>
          <p className="mt-3 font-mono text-lg font-bold text-chai-700">#{order.orderNumber}</p>
        </motion.div>
      )}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          {!justPlaced && <p className="eyebrow">{"// order tracking"}</p>}
          <h1 className={cn("font-extrabold", justPlaced ? "text-xl" : "mt-1.5 text-3xl md:text-4xl")}>
            Order #{order.orderNumber}
          </h1>
          <p className="mt-1.5 text-sm text-charcoal-500">
            Placed {formatDate(order.placedAt, true)} · {ORDER_TYPE_LABEL[order.orderType]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("chip ring-1", ORDER_STATUS_TONE[order.status])}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh order status"
            className="rounded-xl border border-cream-300 bg-white p-2.5 text-charcoal-600 transition hover:border-chai-400"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:gap-8">
        <div className="space-y-5">
          <section className="surface p-5" aria-labelledby="progress-heading">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 id="progress-heading" className="text-lg font-bold">Progress</h2>
              {!cancelled && order.status !== "DELIVERED" && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-cream-100 px-3 py-1.5 text-xs font-semibold text-charcoal-700">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  ~{order.estimatedMinutes} min
                </span>
              )}
            </div>

            {cancelled ? (
              <div className="flex items-start gap-3 rounded-xl bg-chilli-400/10 p-4">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-chilli-500" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-chilli-600">This order was cancelled.</p>
                  {order.cancelReason && (
                    <p className="mt-0.5 text-xs text-charcoal-600">{order.cancelReason}</p>
                  )}
                </div>
              </div>
            ) : (
              <ol className="relative space-y-0">
                {flow.map((status, index) => {
                  const done = index <= currentIndex;
                  const active = index === currentIndex;
                  const isLast = index === flow.length - 1;

                  return (
                    <li key={status} className="relative flex gap-4 pb-6 last:pb-0">
                      {!isLast && (
                        <span
                          className={cn(
                            "absolute left-[13px] top-7 h-[calc(100%-1rem)] w-0.5",
                            done && index < currentIndex ? "bg-circuit-500" : "bg-cream-200",
                          )}
                          aria-hidden
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition",
                          done
                            ? "border-circuit-500 bg-circuit-500 text-white"
                            : "border-cream-300 bg-white text-charcoal-300",
                          active && "ring-4 ring-circuit-500/20",
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
                      </span>
                      <div className="pt-0.5">
                        <p className={cn("text-sm font-semibold", done ? "text-charcoal-900" : "text-charcoal-400")}>
                          {ORDER_STATUS_LABEL[status as keyof typeof ORDER_STATUS_LABEL]}
                        </p>
                        {(() => {
                          const event = order.events.find((e) => e.status === status);
                          return event ? (
                            <p className="text-xs text-charcoal-400">{formatDate(event.createdAt, true)}</p>
                          ) : null;
                        })()}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="surface p-5" aria-labelledby="items-heading">
            <h2 id="items-heading" className="mb-4 text-lg font-bold">
              Items ({order.items.length})
            </h2>
            <ul className="space-y-3">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream-200">
                    {item.productImage && (
                      <Image src={item.productImage} alt="" fill sizes="64px" className="object-cover" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-charcoal-900">{item.productName}</p>
                      <p className="text-xs text-charcoal-400">
                        {item.quantity} × {money(item.unitPrice)}
                      </p>
                      {item.addons.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-charcoal-400">
                          {item.addons.map((a) => a.addonName).join(", ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="mt-0.5 text-[11px] italic text-charcoal-400">“{item.notes}”</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-bold">{money(item.lineTotal)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-5">
            <h2 className="text-lg font-bold">Summary</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-charcoal-500">Subtotal</dt>
                <dd className="font-semibold">{money(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-charcoal-500">Discount {order.couponCode ? `(${order.couponCode})` : ""}</dt>
                  <dd className="font-semibold text-circuit-600">− {money(order.discount)}</dd>
                </div>
              )}
              {order.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-charcoal-500">Delivery fee</dt>
                  <dd className="font-semibold">{money(order.deliveryFee)}</dd>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between">
                  <dt className="text-charcoal-500">Tax</dt>
                  <dd className="font-semibold">{money(order.tax)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-cream-200 pt-3 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-extrabold">{money(order.total)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{PAYMENT_METHOD_LABEL[order.paymentMethod]}</Badge>
              <Badge tone={order.paymentStatus === "PAID" ? "green" : "default"}>
                {order.paymentStatus === "PAID" ? "Paid" : "Unpaid"}
              </Badge>
            </div>
          </div>

          <div className="surface p-5">
            <h2 className="text-base font-bold">
              {order.orderType === "DELIVERY" ? "Delivering to" : "Pickup from"}
            </h2>
            {order.orderType === "DELIVERY" ? (
              <div className="mt-3 flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-chai-600" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-charcoal-900">{order.customerName}</p>
                  <p className="mt-0.5 text-charcoal-600">{order.addressLine}</p>
                  <p className="text-charcoal-600">
                    {[order.area, order.city].filter(Boolean).join(", ")}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-charcoal-500">
                    <Phone className="h-3.5 w-3.5" aria-hidden /> {order.customerPhone}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-3">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-chai-600" aria-hidden />
                <div className="text-sm">
                  <p className="font-semibold text-charcoal-900">Pickup from {settings.cafeName}</p>
                  <p className="mt-0.5 text-charcoal-600">{settings.address}</p>
                  <p className="mt-1 text-xs text-charcoal-400">{settings.openingHours}</p>
                </div>
              </div>
            )}

            {order.instructions && (
              <p className="mt-4 rounded-lg bg-cream-100 px-3 py-2.5 text-xs text-charcoal-600">
                <strong className="font-semibold">Note:</strong> {order.instructions}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Button variant="secondary" className="w-full" onClick={reorder}>
              <ShoppingBag className="h-4 w-4" aria-hidden /> Order Again
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden /> Print receipt
            </Button>
            {canCancel && (
              <Button variant="danger" className="w-full" loading={cancelling} onClick={() => void cancel()}>
                Cancel order
              </Button>
            )}
            <Link href="/menu" className="btn-ghost w-full">Continue Shopping</Link>
          </div>

          <a
            href={`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(
              `Hi ${settings.cafeName}, I have a question about order #${order.orderNumber}.`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-cream-200 bg-white p-4 text-center text-sm font-semibold text-charcoal-700 transition hover:border-circuit-400 hover:text-circuit-600"
          >
            Need help with this order? Message us
          </a>
        </div>
      </div>
    </div>
  );
}

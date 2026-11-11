"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { useMoney } from "@/context/settings-context";
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL } from "@/lib/constants";
import { Button } from "@/components/ui";
import type { PublicTrackingOrder } from "@/server/order-access";
export function PublicOrderTracker({
  initialOrder,
}: {
  initialOrder: PublicTrackingOrder;
}) {
  const [order, setOrder] = useState(initialOrder),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const params = useSearchParams(),
    money = useMoney();
  const token = params.get("tracking") || "";
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const data = await apiGet<{ order: PublicTrackingOrder }>(
        `/api/orders/${initialOrder.orderNumber}?view=tracking&tracking=${encodeURIComponent(token)}`,
      );
      setOrder(data.order);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh order.");
    } finally {
      setBusy(false);
    }
  }, [initialOrder.orderNumber, token]);
  useEffect(() => {
    if (["DELIVERED", "CANCELLED"].includes(order.status)) return;
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, [order.status, refresh]);
  return (
    <div className="container max-w-3xl space-y-6 py-10">
      <section className="surface p-6">
        <p className="eyebrow">Order tracking</p>
        <h1 className="mt-2 text-3xl font-bold">Order #{order.orderNumber}</h1>
        <p className="mt-3 text-lg font-bold text-chai-700">
          {ORDER_STATUS_LABEL[order.status]}
        </p>
        <p className="mt-2 text-sm text-charcoal-600">
          {ORDER_TYPE_LABEL[order.orderType]} ·{" "}
          {order.paymentStatus === "PAID" ? "Paid" : order.paymentStatus === "REFUNDED" ? "Refunded" : "Payment pending"}
        </p>
        <p className="mt-4 text-sm">
          This private receipt link shows progress and the bill. Customer
          contact details are only available after an authorized sign in.
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          loading={busy}
          onClick={() => void refresh()}
        >
          Refresh progress
        </Button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-chilli-600">
            {error}
          </p>
        )}
      </section>
      <section className="surface p-6">
        <h2 className="text-xl font-bold">Your bill</h2>
        <ul className="mt-4 divide-y divide-cream-200">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-4 py-3 text-sm">
              <span>
                {item.quantity} × {item.name}
              </span>
              <strong>{money(item.lineTotal)}</strong>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-sm">
          {[
            ["Subtotal", order.subtotal],
            ["Discount", order.discount ? -order.discount : 0],
            ["Delivery", order.deliveryFee],
            ["Tax", order.tax],
            ["Total", order.total],
          ].map(([label, amount]) => (
            <div key={label} className="flex justify-between">
              <dt>{label}</dt>
              <dd className="font-bold">{money(Number(amount))}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="surface p-6">
        <h2 className="text-xl font-bold">Progress</h2>
        <ol className="mt-4 space-y-3">
          {order.events.map((event, i) => (
            <li
              key={i}
              className="flex flex-wrap justify-between gap-2 text-sm"
            >
              <strong>{ORDER_STATUS_LABEL[event.status]}</strong>
              <time dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleString("en-PK", {
                  timeZone: "Asia/Karachi",
                })}{" "}
                PKT
              </time>
            </li>
          ))}
        </ol>
      </section>
      <div className="flex flex-wrap gap-3">
        <Link href="/menu" className="btn-primary">
          Browse menu
        </Link>
        <Link href="/login" className="btn-secondary">
          Sign in for account details
        </Link>
      </div>
    </div>
  );
}

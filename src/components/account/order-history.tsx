"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { ShoppingBag, RotateCcw, ChevronRight } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useMoney } from "@/context/settings-context";
import { Button, EmptyState } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, ORDER_TYPE_LABEL } from "@/lib/constants";
import type { OrderDTO } from "@/server/orders";

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Current" },
  { value: "DELIVERED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];

export function OrderHistory({ orders }: { orders: OrderDTO[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("ALL");
  const { addItem } = useCart();
  const money = useMoney();

  const visible = orders.filter((order) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIVE") return ACTIVE_STATUSES.includes(order.status);
    return order.status === filter;
  });

  const reorder = (order: OrderDTO) => {
    let added = 0;
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
      added += 1;
    }
    if (added === 0) {
      toast.error("These items are no longer on the menu.");
      return;
    }
    toast.success(`${added} item${added === 1 ? "" : "s"} added to your cart`);
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold md:text-3xl">My Orders</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Every chai break, on record.
      </p>

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter orders">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition",
              filter === option.value
                ? "border-chai-500 bg-chai-50 text-chai-700"
                : "border-cream-300 bg-white text-charcoal-600 hover:border-chai-300",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {visible.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title={filter === "ALL" ? "Your first chai break is waiting." : "Nothing here yet."}
            description={
              filter === "ALL"
                ? "You haven't placed an order yet."
                : "No orders match this filter."
            }
            actionLabel="Order Now"
            actionHref="/menu"
          />
        ) : (
          <ul className="space-y-4">
            {visible.map((order) => (
              <li key={order.id} className="surface overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-200 bg-cream-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-charcoal-900">
                      #{order.orderNumber}
                    </p>
                    <p className="mt-0.5 text-xs text-charcoal-500">
                      {formatDate(order.placedAt, true)} · {ORDER_TYPE_LABEL[order.orderType]}
                    </p>
                  </div>
                  <span className={cn("chip ring-1", ORDER_STATUS_TONE[order.status])}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </span>
                </div>

                <div className="p-4">
                  <ul className="flex flex-wrap gap-2">
                    {order.items.slice(0, 4).map((item) => (
                      <li key={item.id} className="flex items-center gap-2 rounded-xl bg-cream-100 py-1 pl-1 pr-3">
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-cream-200">
                          {item.productImage && (
                            <Image src={item.productImage} alt="" fill sizes="32px" className="object-cover" />
                          )}
                        </span>
                        <span className="text-xs font-medium text-charcoal-700">
                          {item.quantity} × {item.productName}
                        </span>
                      </li>
                    ))}
                    {order.items.length > 4 && (
                      <li className="flex items-center rounded-xl bg-cream-100 px-3 py-1 text-xs font-medium text-charcoal-500">
                        +{order.items.length - 4} more
                      </li>
                    )}
                  </ul>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-cream-200 pt-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-charcoal-400">Total</p>
                      <p className="text-lg font-extrabold text-charcoal-900">{money(order.total)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => reorder(order)}>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Order Again
                      </Button>
                      <Link href={`/orders/${order.orderNumber}`} className="btn-primary px-3.5 py-2 text-xs">
                        Track <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

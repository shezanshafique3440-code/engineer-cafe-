import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag, Heart, MapPin, Wallet, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { buildMetadata } from "@/lib/seo";
import { getSettings } from "@/server/settings";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/constants";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = buildMetadata({
  title: "My Account",
  description: "Your Engineer Cafe account.",
  path: "/account",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [orders, spendAgg, favoriteCount, addressCount, activeOrders, settings] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, orderNumber: true, status: true, total: true, createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.aggregate({
      where: { userId: user.id, status: { not: "CANCELLED" } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.favorite.count({ where: { userId: user.id } }),
    prisma.address.count({ where: { userId: user.id } }),
    prisma.order.findMany({
      where: {
        userId: user.id,
        status: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, orderNumber: true, status: true, total: true, estimatedMinutes: true },
    }),
    getSettings(),
  ]);

  const money = (n: number) => formatCurrency(n, settings.currencySymbol);

  const stats = [
    { label: "Total orders", value: String(spendAgg._count), icon: ShoppingBag, href: "/account/orders" },
    { label: "Total spent", value: money(spendAgg._sum.total ?? 0), icon: Wallet, href: "/account/orders" },
    { label: "Favorites", value: String(favoriteCount), icon: Heart, href: "/account/favorites" },
    { label: "Saved addresses", value: String(addressCount), icon: MapPin, href: "/account/addresses" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-extrabold md:text-3xl">
        Salam, {user.name.split(" ")[0]} 👋
      </h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Here&apos;s everything happening on your account.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="surface p-4 transition hover:border-chai-300 hover:shadow-lift"
          >
            <stat.icon className="mb-2.5 h-4 w-4 text-chai-500" aria-hidden />
            <p className="text-xl font-extrabold text-charcoal-900">{stat.value}</p>
            <p className="mt-0.5 text-xs text-charcoal-500">{stat.label}</p>
          </Link>
        ))}
      </div>

      {activeOrders.length > 0 && (
        <section className="mt-8" aria-labelledby="active-heading">
          <h2 id="active-heading" className="mb-4 text-lg font-bold">Current orders</h2>
          <ul className="space-y-3">
            {activeOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.orderNumber}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-chai-300 bg-chai-50 p-4 transition hover:border-chai-500"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-chai-800">#{order.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-charcoal-600">
                      {ORDER_STATUS_LABEL[order.status]} · ~{order.estimatedMinutes} min
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-bold">{money(order.total)}</span>
                    <ArrowRight className="h-4 w-4 text-chai-600" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8" aria-labelledby="recent-heading">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-lg font-bold">Recent orders</h2>
          <Link href="/account/orders" className="text-sm font-semibold text-chai-700 hover:underline">
            View all
          </Link>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Your first chai break is waiting."
            description="You haven't placed an order yet."
            actionLabel="Order Now"
            actionHref="/menu"
          />
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.orderNumber}`}
                  className="surface flex items-center justify-between gap-4 p-4 transition hover:border-chai-300"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-charcoal-900">#{order.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-charcoal-500">
                      {formatDate(order.createdAt)} · {order._count.items} item
                      {order._count.items === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={cn("chip hidden ring-1 sm:inline-flex", ORDER_STATUS_TONE[order.status])}>
                      {ORDER_STATUS_LABEL[order.status]}
                    </span>
                    <span className="text-sm font-bold">{money(order.total)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

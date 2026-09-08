"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, ShoppingBag, Clock, CheckCircle2, Users,
  Star, Mail, AlertTriangle, Trophy, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { apiGet } from "@/lib/api-client";
import { useMoney } from "@/context/settings-context";
import { PageHeader, StatCard, TableSkeleton } from "./ui";
import { ErrorState } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/constants";
import type { OrderStatus } from "@prisma/client";

type Stats = {
  todaySales: number;
  yesterdaySales: number;
  salesChangePercent: number | null;
  monthSales: number;
  todayOrders: number;
  pendingOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalCustomers: number;
  newCustomersToday: number;
  pendingReviews: number;
  newMessages: number;
  lowStock: number;
  bestSelling: { id: string; name: string; slug: string; image: string | null; soldCount: number; price: number } | null;
};

type RecentOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: OrderStatus;
  orderType: string;
  createdAt: string;
  itemCount: number;
};

type Daily = { date: string; sales: number; orders: number };

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const money = useMoney();

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [statsData, analytics] = await Promise.all([
        apiGet<{ stats: Stats; recentOrders: RecentOrder[] }>("/api/admin/stats"),
        apiGet<{ daily: Daily[] }>("/api/admin/analytics?days=14"),
      ]);
      setStats(statsData.stats);
      setRecent(statsData.recentOrders);
      setDaily(analytics.daily);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Keep the kitchen view fresh without a manual refresh.
    const timer = setInterval(() => void load(), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <ErrorState title="Unable to load dashboard." onRetry={load} />
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface h-28 animate-pulse" />
          ))}
        </div>
        <TableSkeleton />
      </div>
    );
  }

  if (!stats) return null;

  const change = stats.salesChangePercent;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live snapshot of today's service."
        action={
          <Link href="/admin/orders" className="btn-primary">
            Manage orders <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's Sales"
          value={money(stats.todaySales)}
          icon={change !== null && change < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
          tone={change !== null && change < 0 ? "red" : "green"}
          hint={
            change === null
              ? `Yesterday: ${money(stats.yesterdaySales)}`
              : `${change >= 0 ? "+" : ""}${change}% vs yesterday`
          }
        />
        <StatCard
          label="Today's Orders"
          value={String(stats.todayOrders)}
          icon={<ShoppingBag className="h-4 w-4" />}
          hint={`${stats.activeOrders} in the kitchen right now`}
          href="/admin/orders"
        />
        <StatCard
          label="Pending Orders"
          value={String(stats.pendingOrders)}
          icon={<Clock className="h-4 w-4" />}
          tone={stats.pendingOrders > 0 ? "amber" : "default"}
          hint={stats.pendingOrders > 0 ? "Needs confirmation" : "All caught up"}
          href="/admin/orders?status=PENDING"
        />
        <StatCard
          label="Completed Orders"
          value={String(stats.completedOrders)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="green"
          hint="Delivered all-time"
        />
        <StatCard
          label="Total Customers"
          value={String(stats.totalCustomers)}
          icon={<Users className="h-4 w-4" />}
          hint={`${stats.newCustomersToday} joined today`}
          href="/admin/customers"
        />
        <StatCard
          label="Month to Date"
          value={money(stats.monthSales)}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="green"
          hint="Confirmed revenue this month"
          href="/admin/analytics"
        />
        <StatCard
          label="Pending Reviews"
          value={String(stats.pendingReviews)}
          icon={<Star className="h-4 w-4" />}
          tone={stats.pendingReviews > 0 ? "amber" : "default"}
          hint="Awaiting moderation"
          href="/admin/reviews"
        />
        <StatCard
          label="New Messages"
          value={String(stats.newMessages)}
          icon={<Mail className="h-4 w-4" />}
          tone={stats.newMessages > 0 ? "amber" : "default"}
          hint="From the contact form"
          href="/admin/messages"
        />
      </div>

      {stats.lowStock > 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="text-sm font-bold text-amber-900">
              {stats.lowStock} item{stats.lowStock === 1 ? "" : "s"} running low on stock.
            </p>
            <Link href="/admin/products" className="text-xs font-semibold text-amber-700 hover:underline">
              Review inventory →
            </Link>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="surface p-5 lg:col-span-2" aria-labelledby="sales-chart-heading">
          <h2 id="sales-chart-heading" className="mb-5 text-lg font-bold">
            Sales — last 14 days
          </h2>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B9722A" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#B9722A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D6" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => value.slice(5)}
                  tick={{ fontSize: 11, fill: "#A8A29E" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#A8A29E" }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                />
                <Tooltip
                  formatter={(value: number) => [money(value), "Sales"]}
                  labelFormatter={(label: string) => formatDate(label)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #F0E6D6",
                    fontSize: 12,
                    boxShadow: "0 8px 24px -12px rgba(35,32,32,.2)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#B9722A"
                  strokeWidth={2}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface p-5" aria-labelledby="best-seller-heading">
          <h2 id="best-seller-heading" className="mb-4 text-lg font-bold">Best selling</h2>
          {stats.bestSelling ? (
            <div>
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-chai-100 text-chai-600">
                <Trophy className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <p className="text-lg font-bold text-charcoal-900">{stats.bestSelling.name}</p>
              <p className="mt-1 text-sm text-charcoal-500">
                {stats.bestSelling.soldCount} sold · {money(stats.bestSelling.price)}
              </p>
              <Link
                href="/admin/products"
                className="mt-4 inline-flex text-sm font-semibold text-chai-700 hover:underline"
              >
                Manage products →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-charcoal-400">No sales recorded yet.</p>
          )}
        </section>
      </div>

      <section className="mt-6" aria-labelledby="recent-orders-heading">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="recent-orders-heading" className="text-lg font-bold">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm font-semibold text-chai-700 hover:underline">
            View all
          </Link>
        </div>

        <div className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 bg-cream-50">
                  {["Order", "Customer", "Items", "Total", "Status", "Placed"].map((column) => (
                    <th key={column} scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-charcoal-400">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {recent.map((order) => (
                  <tr key={order.id} className="transition hover:bg-cream-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders?search=${order.orderNumber}`} className="font-mono font-bold text-chai-700 hover:underline">
                        #{order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-charcoal-700">{order.customerName}</td>
                    <td className="px-4 py-3 text-charcoal-500">{order.itemCount}</td>
                    <td className="px-4 py-3 font-bold text-charcoal-900">{money(order.total)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("chip ring-1", ORDER_STATUS_TONE[order.status])}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-charcoal-400">
                      {formatDate(order.createdAt, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {recent.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-charcoal-400">No orders yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

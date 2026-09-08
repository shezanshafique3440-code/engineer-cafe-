"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { TrendingUp, ShoppingBag, Receipt, Package } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { useMoney } from "@/context/settings-context";
import { PageHeader, StatCard } from "./ui";
import { ErrorState, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";

type Analytics = {
  summary: { grossSales: number; orders: number; averageOrderValue: number; itemsSold: number };
  daily: { date: string; sales: number; orders: number }[];
  weekly: { week: string; sales: number; orders: number }[];
  monthly: { month: string; sales: number; orders: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  byCategory: { name: string; quantity: number }[];
  byOrderType: { name: string; value: number }[];
  byPayment: { name: string; value: number }[];
};

// Distinct, accessible hues that stay legible against the cream background.
const PALETTE = ["#B9722A", "#20A06E", "#D6412D", "#57534E", "#DBA363", "#158055"];

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #F0E6D6",
  fontSize: 12,
  boxShadow: "0 8px 24px -12px rgba(35,32,32,.2)",
};

export function AnalyticsView() {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const money = useMoney();

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await apiGet<Analytics>(`/api/admin/analytics?days=${days}`));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <ErrorState title="Unable to load analytics." onRetry={load} />
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface h-28 animate-pulse" />
          ))}
        </div>
        <div className="surface mt-6 h-80 animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Revenue counts confirmed orders only — cancelled orders are excluded."
        action={
          <div className="w-40">
            <Select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Date range">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gross sales" value={money(data.summary.grossSales)} icon={<TrendingUp className="h-4 w-4" />} tone="green" hint={`Over the last ${days} days`} />
        <StatCard label="Orders" value={String(data.summary.orders)} icon={<ShoppingBag className="h-4 w-4" />} hint="Confirmed and beyond" />
        <StatCard label="Average order" value={money(data.summary.averageOrderValue)} icon={<Receipt className="h-4 w-4" />} hint="Per confirmed order" />
        <StatCard label="Items sold" value={String(data.summary.itemsSold)} icon={<Package className="h-4 w-4" />} hint="Total units" />
      </div>

      <section className="surface mt-6 p-5" aria-labelledby="daily-heading">
        <h2 id="daily-heading" className="mb-5 text-lg font-bold">Daily sales</h2>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.daily} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B9722A" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#B9722A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D6" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 11, fill: "#A8A29E" }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tick={{ fontSize: 11, fill: "#A8A29E" }} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                formatter={(value: number, name: string) => [name === "sales" ? money(value) : value, name === "sales" ? "Sales" : "Orders"]}
                labelFormatter={(label: string) => formatDate(label)}
                contentStyle={TOOLTIP_STYLE}
              />
              <Area type="monotone" dataKey="sales" stroke="#B9722A" strokeWidth={2} fill="url(#dailyFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="surface p-5" aria-labelledby="weekly-heading">
          <h2 id="weekly-heading" className="mb-5 text-lg font-bold">Weekly sales</h2>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekly} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D6" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#A8A29E" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#A8A29E" }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(value: number) => [money(value), "Sales"]} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#F8F3EA" }} />
                <Bar dataKey="sales" fill="#B9722A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface p-5" aria-labelledby="monthly-heading">
          <h2 id="monthly-heading" className="mb-5 text-lg font-bold">Monthly sales (12 months)</h2>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#A8A29E" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#A8A29E" }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(value: number) => [money(value), "Sales"]} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#F8F3EA" }} />
                <Bar dataKey="sales" fill="#20A06E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface p-5" aria-labelledby="category-heading">
          <h2 id="category-heading" className="mb-5 text-lg font-bold">Orders by category</h2>
          {data.byCategory.length === 0 ? (
            <p className="py-16 text-center text-sm text-charcoal-400">No sales data yet.</p>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byCategory} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#A8A29E" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#57534E" }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip formatter={(value: number) => [`${value} items`, "Sold"]} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#F8F3EA" }} />
                  <Bar dataKey="quantity" fill="#CE8A3C" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="surface p-5" aria-labelledby="split-heading">
          <h2 id="split-heading" className="mb-5 text-lg font-bold">Delivery vs pickup</h2>
          {data.byOrderType.every((d) => d.value === 0) ? (
            <p className="py-16 text-center text-sm text-charcoal-400">No orders in this range.</p>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byOrderType}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {data.byOrderType.map((entry, index) => (
                      <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} orders`, ""]} contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="surface p-5" aria-labelledby="top-products-heading">
          <h2 id="top-products-heading" className="mb-4 text-lg font-bold">Top selling products</h2>
          {data.topProducts.length === 0 ? (
            <p className="py-10 text-center text-sm text-charcoal-400">No sales data yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {data.topProducts.map((product, index) => (
                <li key={product.name} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-chai-100 text-xs font-bold text-chai-700">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-charcoal-800">{product.name}</span>
                    <span className="block text-xs text-charcoal-400">{product.quantity} sold</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-charcoal-900">{money(product.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="surface p-5" aria-labelledby="payment-heading">
          <h2 id="payment-heading" className="mb-4 text-lg font-bold">Payment methods</h2>
          {data.byPayment.length === 0 ? (
            <p className="py-10 text-center text-sm text-charcoal-400">No orders in this range.</p>
          ) : (
            <ul className="space-y-3">
              {data.byPayment.map((method, index) => {
                const totalCount = data.byPayment.reduce((sum, m) => sum + m.value, 0);
                const percent = totalCount ? Math.round((method.value / totalCount) * 100) : 0;
                return (
                  <li key={method.name}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-charcoal-700">
                        {PAYMENT_METHOD_LABEL[method.name as keyof typeof PAYMENT_METHOD_LABEL] ?? method.name}
                      </span>
                      <span className="text-charcoal-500">{method.value} · {percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-cream-200">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${percent}%`, backgroundColor: PALETTE[index % PALETTE.length] }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

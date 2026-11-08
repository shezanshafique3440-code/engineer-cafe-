"use client";
import { useEffect, useState } from "react";
import { can } from "@/lib/permissions";
import { useSession } from "@/context/session-context";
import { useMoney } from "@/context/settings-context";
import { apiGet } from "@/lib/api-client";
import { StatCard } from "./ui";
export function OperationsOverview() {
  const { user } = useSession();
  const money = useMoney();
  const [stats, setStats] = useState<{
    low?: number;
    riders?: number;
    jobs?: number;
    due?: number;
    sales?: number;
    profit?: number | null;
  }>({});
  useEffect(() => {
    let active = true;
    const requests: Promise<void>[] = [];
    if (can(user, "inventory"))
      requests.push(
        apiGet<{ items: { low: boolean }[] }>(
          "/api/admin/operations/inventory",
        ).then((r) => {
          if (active)
            setStats((s) => ({
              ...s,
              low: r.items.filter((i) => i.low).length,
            }));
        }),
      );
    if (can(user, "delivery"))
      requests.push(
        apiGet<{
          riders: { isActive: boolean; active: number; due: number }[];
        }>("/api/admin/operations/delivery").then((r) => {
          if (active)
            setStats((s) => ({
              ...s,
              riders: r.riders.filter((i) => i.isActive).length,
              jobs: r.riders.reduce((n, i) => n + i.active, 0),
              due: r.riders.reduce((n, i) => n + i.due, 0),
            }));
        }),
      );
    if (can(user, "finance"))
      requests.push(
        apiGet<{
          summary: { netMerchandiseSales: number; netProfit: number | null };
        }>("/api/admin/operations/finance").then((r) => {
          if (active)
            setStats((s) => ({
              ...s,
              sales: r.summary.netMerchandiseSales,
              profit: r.summary.netProfit,
            }));
        }),
      );
    void Promise.allSettled(requests);
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.low !== undefined && (
        <StatCard
          label="Low-stock ingredients"
          value={String(stats.low)}
          tone={stats.low ? "amber" : "green"}
          href="/admin/inventory"
        />
      )}
      {stats.riders !== undefined && (
        <StatCard
          label="Delivery team"
          value={`${stats.riders} riders · ${stats.jobs} jobs`}
          hint={`Commission due ${money(stats.due || 0)}`}
          href="/admin/delivery"
        />
      )}
      {stats.sales !== undefined && (
        <StatCard
          label="Today's completed food sales"
          value={money(stats.sales)}
          href="/admin/finance"
        />
      )}
      {stats.profit !== undefined && (
        <StatCard
          label="Today's profit"
          value={
            stats.profit === null ? "Costs incomplete" : money(stats.profit)
          }
          href="/admin/finance"
        />
      )}
    </div>
  );
}

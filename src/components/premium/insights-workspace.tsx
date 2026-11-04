"use client";
import { useEffect, useState } from "react";
import {
  Download,
  RefreshCw,
  TrendingUp,
  Users,
  Clock3,
  Package,
} from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { downloadCsv } from "@/lib/csv";
import type { CafeInsights } from "@/lib/cafe-insights";
import { PageHeader, StatCard, DataTable } from "@/components/admin/ui";
import { Button, Select, ErrorState } from "@/components/ui";
import { useMoney } from "@/context/settings-context";
import { cn } from "@/lib/utils";
type Data = CafeInsights & {
  range: {
    days: number;
    sampledOrders: number;
    truncated: boolean;
    menuTruncated: boolean;
    timezone: string;
  };
};
export function InsightsWorkspace() {
  const [data, setData] = useState<Data | null>(null),
    [days, setDays] = useState("90"),
    [tab, setTab] = useState("overview"),
    [segment, setSegment] = useState("All"),
    [error, setError] = useState(false),
    [refresh, setRefresh] = useState(0),
    [search, setSearch] = useState("");
  const money = useMoney();
  useEffect(() => {
    let active = true;
    setData(null);
    setError(false);
    apiGet<Data>(`/api/admin/insights?days=${days}`)
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [days, refresh]);
  const customers = (data?.customers ?? []).filter(
    (c) =>
      (segment === "All" || c.segment === segment) &&
      `${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()),
  );
  const maximum = Math.max(
    1,
    ...(data?.heatmap.flatMap((row) => row.hours) ?? []),
  );
  return (
    <div>
      <PageHeader
        title="Business intelligence"
        description="Understand the service, spot repeat customers and make menu decisions with your own data."
        action={
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label="Insight date range"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            >
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 365 days</option>
            </Select>
            <Button
              variant="secondary"
              aria-label="Refresh insights"
              onClick={() => setRefresh((v) => v + 1)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ["overview", "Service overview"],
          ["customers", "Customer segments"],
          ["menu", "Menu signals"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-semibold",
              tab === value
                ? "border-chai-500 bg-chai-100 text-chai-700"
                : "bg-surface",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState
          title="Insights could not load."
          onRetry={() => setRefresh((v) => v + 1)}
        />
      ) : !data ? (
        <p role="status" className="py-12 text-center">
          Calculating from your order history…
        </p>
      ) : (
        <>
          {(data.range.truncated || data.range.menuTruncated) && (
            <p
              role="status"
              className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
            >
              Large dataset: insights use the most recent{" "}
              {data.range.sampledOrders} orders and up to 2,000 menu items.
              Results may be partial.
            </p>
          )}
          {tab === "overview" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Delivered order value"
                  value={money(data.summary.deliveredValue)}
                  hint={`${data.summary.delivered} delivered orders; includes fees and tax.`}
                  icon={<TrendingUp className="h-4 w-4" />}
                />
                <StatCard
                  label="Repeat customer share"
                  value={`${data.summary.repeatRate}%`}
                  hint="Phone/account groups with 2+ delivered orders in this range."
                  icon={<Users className="h-4 w-4" />}
                />
                <StatCard
                  label="Outstanding order value"
                  value={money(data.summary.outstanding)}
                  hint="Unpaid confirmed, preparing, ready, dispatched or delivered orders."
                  tone="amber"
                />
                <StatCard
                  label="Cancellation rate"
                  value={`${data.summary.cancellationRate}%`}
                  hint={`${data.summary.cancelled} cancelled orders in this range.`}
                />
              </div>
              <div className="surface mt-5 p-4 sm:p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Clock3 className="h-5 w-5 text-chai-600" />
                  When your cafe gets busy
                </h2>
                <p className="mt-1 text-sm text-charcoal-500">
                  Non-cancelled orders by placement time · Asia/Karachi. Scroll
                  the grid to see all 24 hours.
                </p>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
                    <caption className="sr-only">
                      Orders by weekday and hour in Pakistan time
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Day</th>
                        {Array.from({ length: 24 }, (_, h) => (
                          <th
                            key={h}
                            scope="col"
                            className="font-normal text-charcoal-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.heatmap.map((row) => (
                        <tr key={row.day}>
                          <th
                            scope="row"
                            className="pr-2 text-left font-semibold"
                          >
                            {row.day}
                          </th>
                          {row.hours.map((count, h) => (
                            <td
                              key={h}
                              title={`${row.day} ${h}:00: ${count} orders`}
                              className="h-7 rounded-md text-center"
                              style={{
                                backgroundColor: `rgb(var(--c-chai-500) / ${count ? 0.15 + (count / maximum) * 0.65 : 0.05})`,
                              }}
                            >
                              {count || "·"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-sm font-semibold text-chai-700">
                  {data.peak
                    ? `Busiest observed slot: ${data.peak.day} at ${data.peak.hour}:00 (${data.peak.orders} orders). Plan staffing around actual demand.`
                    : "No order history yet. The heatmap fills as orders arrive."}
                </p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="Paid delivered value"
                  value={money(data.summary.paidValue)}
                  hint="Only delivered orders marked paid; not a profit calculation."
                />
                <StatCard
                  label="Average delivered order"
                  value={money(data.summary.averageOrderValue)}
                  hint="Delivered order value ÷ delivered orders."
                />
              </div>
            </>
          )}
          {tab === "customers" && (
            <>
              <div className="surface mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_180px_auto]">
                <input
                  className="field"
                  type="search"
                  aria-label="Find a customer segment"
                  placeholder="Name or phone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select
                  aria-label="Customer segment"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                >
                  {["All", "VIP", "Returning", "At risk", "New"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  disabled={!customers.length}
                  onClick={() =>
                    downloadCsv(
                      "cafe-customer-segments.csv",
                      [
                        "Name",
                        "Phone",
                        "Segment",
                        "Delivered orders",
                        "Order value",
                        "Days since last order",
                      ],
                      customers.map((c) => [
                        c.name,
                        c.phone,
                        c.segment,
                        c.orders,
                        c.spend,
                        c.daysSince,
                      ]),
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Export filtered
                </Button>
              </div>
              <p className="mb-4 text-xs leading-relaxed text-charcoal-500">
                Groups use phone numbers, with account ID as a fallback. At
                risk: 2+ delivered orders, last one 21+ days ago. VIP: 3+ orders
                and at least 1.5× average customer value. All rules use this
                selected date range.
              </p>
              <DataTable
                columns={[
                  "Customer",
                  "Segment",
                  "Orders",
                  "Order value",
                  "Last visit",
                ]}
                empty={!customers.length}
              >
                {customers.map((c) => (
                  <tr key={c.key}>
                    <td className="p-3">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-charcoal-500">{c.phone}</p>
                    </td>
                    <td className="p-3">
                      <span className="chip bg-chai-100 text-chai-700">
                        {c.segment}
                      </span>
                    </td>
                    <td className="p-3">{c.orders}</td>
                    <td className="p-3 font-semibold">{money(c.spend)}</td>
                    <td className="p-3">{c.daysSince} days ago</td>
                  </tr>
                ))}
              </DataTable>
            </>
          )}
          {tab === "menu" && (
            <>
              <div className="surface mb-4 p-4">
                <h2 className="flex items-center gap-2 font-bold">
                  <Package className="h-5 w-5 text-chai-600" />
                  Make the next menu decision
                </h2>
                <p className="mt-2 text-sm text-charcoal-500">
                  Hidden gem = rating ≥ 4.5 from 3+ reviews, fewer than 5 units
                  delivered. Popular = 5+ units delivered. Low stock = 5 or
                  fewer units left. Signals are rules based on current data, not
                  predictions.
                </p>
              </div>
              <DataTable
                columns={[
                  "Product",
                  "Signal",
                  "Units delivered",
                  "Item revenue",
                  "Stock",
                ]}
                empty={!data.menu.length}
              >
                {data.menu.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3 font-semibold">{p.name}</td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "chip",
                          p.signal === "Low stock"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-cream-100",
                        )}
                      >
                        {p.signal}
                      </span>
                    </td>
                    <td className="p-3">{p.quantity}</td>
                    <td className="p-3">{money(p.revenue)}</td>
                    <td className="p-3">{p.stock ?? "Unlimited"}</td>
                  </tr>
                ))}
              </DataTable>
            </>
          )}
          <p className="mt-5 text-xs text-charcoal-500">
            Based on {data.range.sampledOrders} orders in this range. Cancelled
            orders never contribute to delivered revenue.
          </p>
        </>
      )}
    </div>
  );
}

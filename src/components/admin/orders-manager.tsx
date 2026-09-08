"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Printer, Eye, RefreshCw, Phone, MapPin } from "lucide-react";
import { apiGet, apiPatch, ApiError } from "@/lib/api-client";
import { useMoney, useSettings } from "@/context/settings-context";
import { PageHeader, DataTable, TableSkeleton, Modal } from "./ui";
import { Button, Select, ErrorState, Badge } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_TONE, ORDER_TYPE_LABEL,
  PAYMENT_METHOD_LABEL, nextStatuses,
} from "@/lib/constants";
import type { OrderDTO } from "@/server/orders";
import type { OrderStatus } from "@prisma/client";

const STATUS_OPTIONS = [
  "ALL", "PENDING", "CONFIRMED", "PREPARING", "READY",
  "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
] as const;

export function OrdersManager() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <OrdersManagerInner />
    </Suspense>
  );
}

function OrdersManagerInner() {
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [viewing, setViewing] = useState<OrderDTO | null>(null);

  const [filters, setFilters] = useState({
    search: "",
    status: "ALL",
    orderType: "ALL",
    from: "",
    to: "",
  });

  const money = useMoney();
  const settings = useSettings();

  const load = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({
          status: filters.status,
          orderType: filters.orderType,
          page: String(targetPage),
          perPage: "20",
        });
        if (filters.search.trim()) params.set("search", filters.search.trim());
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);

        const data = await apiGet<{
          orders: OrderDTO[];
          total: number;
          totalPages: number;
          statusCounts: Record<string, number>;
        }>(`/api/admin/orders?${params}`);

        setOrders(data.orders);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setStatusCounts(data.statusCounts);
        setPage(targetPage);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  // Pick up a ?search= or ?status= arriving from the dashboard links.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const search = params.get("search");
    const status = params.get("status");
    if (search || status) {
      setFilters((current) => ({
        ...current,
        search: search ?? current.search,
        status: status ?? current.status,
      }));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(1), 260);
    return () => clearTimeout(timer);
  }, [load]);

  const updateStatus = async (order: OrderDTO, status: OrderStatus) => {
    if (status === "CANCELLED" && !window.confirm(`Cancel order #${order.orderNumber}?`)) return;
    setUpdating(order.id);
    try {
      const data = await apiPatch<{ order: OrderDTO }>(`/api/admin/orders/${order.id}`, { status });
      setOrders((current) => current.map((o) => (o.id === order.id ? data.order : o)));
      if (viewing?.id === order.id) setViewing(data.order);
      toast.success(`#${order.orderNumber} → ${ORDER_STATUS_LABEL[status]}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update this order.");
    } finally {
      setUpdating(null);
    }
  };

  const printOrder = (order: OrderDTO) => {
    const win = window.open("", "_blank", "width=420,height=640");
    if (!win) {
      toast.error("Allow pop-ups to print the order slip.");
      return;
    }
    const rows = order.items
      .map(
        (item) => `<tr>
          <td>${item.quantity} × ${escapeHtml(item.productName)}${
            item.addons.length
              ? `<br><small>${escapeHtml(item.addons.map((a) => a.addonName).join(", "))}</small>`
              : ""
          }</td>
          <td style="text-align:right">${money(item.lineTotal)}</td>
        </tr>`,
      )
      .join("");

    win.document.write(`<!doctype html><html><head><title>Order ${order.orderNumber}</title>
      <style>
        body{font-family:ui-monospace,monospace;font-size:12px;padding:16px;color:#171414}
        h1{font-size:16px;margin:0 0 2px}
        table{width:100%;border-collapse:collapse;margin:12px 0}
        td{padding:4px 0;vertical-align:top}
        hr{border:none;border-top:1px dashed #999;margin:10px 0}
        .row{display:flex;justify-content:space-between}
        .total{font-weight:700;font-size:14px}
        small{color:#666}
      </style></head><body>
      <h1>${escapeHtml(settings.cafeName)}</h1>
      <small>${escapeHtml(settings.address)}<br>${escapeHtml(settings.phone)}</small>
      <hr>
      <div class="row"><strong>#${order.orderNumber}</strong><span>${ORDER_TYPE_LABEL[order.orderType]}</span></div>
      <small>${formatDate(order.placedAt, true)}</small>
      <hr>
      <div>${escapeHtml(order.customerName)} · ${escapeHtml(order.customerPhone)}</div>
      ${order.addressLine ? `<small>${escapeHtml(order.addressLine)}, ${escapeHtml(order.area ?? "")} ${escapeHtml(order.city ?? "")}</small>` : ""}
      ${order.instructions ? `<div><small><em>Note: ${escapeHtml(order.instructions)}</em></small></div>` : ""}
      <table>${rows}</table>
      <hr>
      <div class="row"><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
      ${order.discount ? `<div class="row"><span>Discount ${escapeHtml(order.couponCode ?? "")}</span><span>-${money(order.discount)}</span></div>` : ""}
      ${order.deliveryFee ? `<div class="row"><span>Delivery</span><span>${money(order.deliveryFee)}</span></div>` : ""}
      ${order.tax ? `<div class="row"><span>Tax</span><span>${money(order.tax)}</span></div>` : ""}
      <div class="row total"><span>TOTAL</span><span>${money(order.total)}</span></div>
      <hr>
      <div>${PAYMENT_METHOD_LABEL[order.paymentMethod]}</div>
      <p style="text-align:center;margin-top:16px">Chai. Paratha. Engineering wali vibes.</p>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div>
      <PageHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"} matching your filters.`}
        action={
          <Button variant="secondary" onClick={() => void load(page)}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden /> Refresh
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilters((c) => ({ ...c, status }))}
            aria-pressed={filters.status === status}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
              filters.status === status
                ? "border-chai-500 bg-chai-50 text-chai-700"
                : "border-cream-300 bg-white text-charcoal-600 hover:border-chai-300",
            )}
          >
            {status === "ALL" ? "All" : ORDER_STATUS_LABEL[status]}
            {status !== "ALL" && statusCounts[status] ? (
              <span className="ml-1.5 text-charcoal-400">{statusCounts[status]}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="surface mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <label htmlFor="order-search" className="label">Search</label>
          <Search className="pointer-events-none absolute left-3.5 top-[34px] h-4 w-4 text-charcoal-300" aria-hidden />
          <input
            id="order-search"
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((c) => ({ ...c, search: e.target.value }))}
            placeholder="Order #, name or phone"
            className="field pl-10"
          />
        </div>
        <Select
          label="Order type"
          value={filters.orderType}
          onChange={(e) => setFilters((c) => ({ ...c, orderType: e.target.value }))}
        >
          <option value="ALL">All types</option>
          <option value="DELIVERY">Delivery</option>
          <option value="PICKUP">Pickup</option>
        </Select>
        <div>
          <label htmlFor="from-date" className="label">From</label>
          <input
            id="from-date"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((c) => ({ ...c, from: e.target.value }))}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="to-date" className="label">To</label>
          <input
            id="to-date"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((c) => ({ ...c, to: e.target.value }))}
            className="field"
          />
        </div>
      </div>

      {error ? (
        <ErrorState title="Unable to load orders." onRetry={() => void load(page)} />
      ) : loading && orders.length === 0 ? (
        <TableSkeleton cols={7} />
      ) : (
        <>
          <DataTable
            columns={["Order", "Customer", "Items", "Total", "Payment", "Type", "Status", "Date", "Actions"]}
            empty={orders.length === 0}
          >
            {orders.map((order) => {
              const options = nextStatuses(order.status, order.orderType);
              return (
                <tr key={order.id} className="transition hover:bg-cream-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setViewing(order)}
                      className="font-mono font-bold text-chai-700 hover:underline"
                    >
                      #{order.orderNumber}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-charcoal-800">{order.customerName}</p>
                    <p className="text-xs text-charcoal-400">{order.customerPhone}</p>
                  </td>
                  <td className="px-4 py-3 text-charcoal-500">{order.items.length}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-charcoal-900">
                    {money(order.total)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-charcoal-500">
                    {PAYMENT_METHOD_LABEL[order.paymentMethod]}
                    <br />
                    <span className={order.paymentStatus === "PAID" ? "text-circuit-600" : "text-charcoal-400"}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-charcoal-500">
                    {ORDER_TYPE_LABEL[order.orderType]}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("chip ring-1", ORDER_STATUS_TONE[order.status])}>
                      {ORDER_STATUS_LABEL[order.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-charcoal-400">
                    {formatDate(order.placedAt, true)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {options.length > 0 && (
                        <select
                          aria-label={`Change status of order ${order.orderNumber}`}
                          disabled={updating === order.id}
                          value=""
                          onChange={(e) => {
                            if (e.target.value) void updateStatus(order, e.target.value as OrderStatus);
                          }}
                          className="rounded-lg border border-cream-300 bg-white px-2 py-1.5 text-xs font-medium text-charcoal-700"
                        >
                          <option value="">Change…</option>
                          {options.map((status) => (
                            <option key={status} value={status}>
                              {ORDER_STATUS_LABEL[status]}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => setViewing(order)}
                        aria-label={`View order ${order.orderNumber}`}
                        className="rounded-lg p-1.5 text-charcoal-400 transition hover:bg-cream-100 hover:text-chai-600"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => printOrder(order)}
                        aria-label={`Print order ${order.orderNumber}`}
                        className="rounded-lg p-1.5 text-charcoal-400 transition hover:bg-cream-100 hover:text-chai-600"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-charcoal-500">Page {page} of {totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => void load(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing ? `Order #${viewing.orderNumber}` : ""}
        size="lg"
      >
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("chip ring-1", ORDER_STATUS_TONE[viewing.status])}>
                {ORDER_STATUS_LABEL[viewing.status]}
              </span>
              <Badge>{ORDER_TYPE_LABEL[viewing.orderType]}</Badge>
              <Badge>{PAYMENT_METHOD_LABEL[viewing.paymentMethod]}</Badge>
              <Badge tone={viewing.paymentStatus === "PAID" ? "green" : "default"}>
                {viewing.paymentStatus}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-cream-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal-400">Customer</p>
                <p className="text-sm font-semibold text-charcoal-900">{viewing.customerName}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-charcoal-600">
                  <Phone className="h-3 w-3" aria-hidden />
                  <a href={`tel:${viewing.customerPhone}`} className="hover:underline">{viewing.customerPhone}</a>
                </p>
                {viewing.customerEmail && (
                  <p className="mt-0.5 truncate text-xs text-charcoal-500">{viewing.customerEmail}</p>
                )}
              </div>

              <div className="rounded-xl bg-cream-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal-400">
                  {viewing.orderType === "DELIVERY" ? "Delivery address" : "Pickup"}
                </p>
                {viewing.orderType === "DELIVERY" ? (
                  <p className="flex gap-2 text-xs leading-relaxed text-charcoal-600">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    <span>
                      {viewing.addressLine}
                      <br />
                      {[viewing.area, viewing.city].filter(Boolean).join(", ")}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-charcoal-600">Collecting from the counter.</p>
                )}
                {viewing.instructions && (
                  <p className="mt-2 text-xs italic text-charcoal-500">“{viewing.instructions}”</p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal-400">Items</p>
              <ul className="divide-y divide-cream-200 rounded-xl border border-cream-200">
                {viewing.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal-800">
                        {item.quantity} × {item.productName}
                      </p>
                      {item.addons.length > 0 && (
                        <p className="text-xs text-charcoal-400">
                          {item.addons.map((a) => `${a.addonName}${a.price ? ` (+${money(a.price)})` : ""}`).join(", ")}
                        </p>
                      )}
                      {item.notes && <p className="text-xs italic text-charcoal-400">“{item.notes}”</p>}
                    </div>
                    <span className="shrink-0 text-sm font-bold">{money(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <dl className="space-y-2 rounded-xl bg-cream-50 p-4 text-sm">
              <div className="flex justify-between"><dt className="text-charcoal-500">Subtotal</dt><dd className="font-semibold">{money(viewing.subtotal)}</dd></div>
              {viewing.discount > 0 && (
                <div className="flex justify-between"><dt className="text-charcoal-500">Discount {viewing.couponCode}</dt><dd className="font-semibold text-circuit-600">− {money(viewing.discount)}</dd></div>
              )}
              {viewing.deliveryFee > 0 && (
                <div className="flex justify-between"><dt className="text-charcoal-500">Delivery</dt><dd className="font-semibold">{money(viewing.deliveryFee)}</dd></div>
              )}
              {viewing.tax > 0 && (
                <div className="flex justify-between"><dt className="text-charcoal-500">Tax</dt><dd className="font-semibold">{money(viewing.tax)}</dd></div>
              )}
              <div className="flex justify-between border-t border-cream-200 pt-2 text-base">
                <dt className="font-bold">Total</dt><dd className="font-extrabold">{money(viewing.total)}</dd>
              </div>
            </dl>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal-400">Timeline</p>
              <ol className="space-y-1.5">
                {viewing.events.map((event) => (
                  <li key={event.id} className="flex justify-between gap-3 text-xs">
                    <span className="font-medium text-charcoal-700">
                      {ORDER_STATUS_LABEL[event.status]}
                      {event.note && <span className="ml-1.5 font-normal text-charcoal-400">— {event.note}</span>}
                    </span>
                    <span className="shrink-0 text-charcoal-400">{formatDate(event.createdAt, true)}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-cream-200 pt-4">
              {nextStatuses(viewing.status, viewing.orderType).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={status === "CANCELLED" ? "danger" : "primary"}
                  loading={updating === viewing.id}
                  onClick={() => void updateStatus(viewing, status)}
                >
                  Mark {ORDER_STATUS_LABEL[status]}
                </Button>
              ))}
              <Button size="sm" variant="secondary" onClick={() => printOrder(viewing)}>
                <Printer className="h-3.5 w-3.5" aria-hidden /> Print
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

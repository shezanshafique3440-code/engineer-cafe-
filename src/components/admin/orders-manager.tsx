"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Printer, Eye, RefreshCw, Phone, MapPin, MessageCircle, Download, Trash2 } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { apiDelete, apiGet, apiPatch, ApiError } from "@/lib/api-client";
import { useSession } from "@/context/session-context";
import { useMoney, useSettings } from "@/context/settings-context";
import { PageHeader, DataTable, TableSkeleton, Modal } from "./ui";
import { Button, Select, ErrorState, Badge } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_TONE, ORDER_TYPE_LABEL,
  PAYMENT_METHOD_LABEL, nextStatuses, allStatuses,
} from "@/lib/constants";
import { whatsappOrderHref, toWhatsAppNumber, NOTIFY_LABEL, ORDERS_CHANGED_EVENT } from "@/lib/notifications";
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
  const [deleting, setDeleting] = useState<OrderDTO | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const refreshButton = useRef<HTMLButtonElement>(null);

  const [filters, setFilters] = useState({
    search: "",
    status: "ALL",
    orderType: "ALL",
    from: "",
    to: "",
  });

  const money = useMoney();
  const settings = useSettings();
  const { user } = useSession();
  const canDelete = user?.role === "ADMIN";

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

  /**
   * Opens WhatsApp with the status update pre-typed for this customer. The
   * cafe has no messaging API, so the send stays a deliberate one-tap action
   * by whoever is on the counter.
   */
  const notifyCustomer = (order: OrderDTO, status: OrderStatus = order.status) => {
    const href = whatsappOrderHref(order, status, {
      cafeName: settings.cafeName,
      money,
      origin: window.location.origin,
      orderId: order.id,
    });
    if (!href) {
      toast.error(`${order.customerPhone} is not a valid WhatsApp number.`);
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const updateStatus = async (order: OrderDTO, status: OrderStatus) => {
    if (status === "CANCELLED" && !window.confirm(`Cancel order #${order.orderNumber}?`)) return;
    if (status === "DELIVERED" && !window.confirm(order.paymentMethod === "ONLINE"
      ? `Confirm order #${order.orderNumber} has been handed over?`
      : `Confirm order #${order.orderNumber} has been handed over and ${money(order.total)} cash received?`)) return;
    setUpdating(order.id);
    try {
      const data = await apiPatch<{ order: OrderDTO }>(`/api/admin/orders/${order.id}`, { status });
      setOrders((current) => current.map((o) => (o.id === order.id ? data.order : o)));
      if (viewing?.id === order.id) setViewing(data.order);
      window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT));

      // Every status change is worth telling the customer about, so the toast
      // carries the send rather than leaving it to be remembered.
      const canNotify = Boolean(toWhatsAppNumber(data.order.customerPhone));
      toast.success(`#${order.orderNumber} → ${ORDER_STATUS_LABEL[status]}`, {
        description: canNotify ? `Tell ${data.order.customerName} on WhatsApp?` : undefined,
        action: canNotify
          ? { label: "Send", onClick: () => notifyCustomer(data.order, status) }
          : undefined,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update this order.");
    } finally {
      setUpdating(null);
    }
  };

  const requestDelete = (order: OrderDTO) => {
    setViewing(null);
    setDeleting(order);
  };

  const confirmDelete = async () => {
    if (!deleting || deletingBusy) return;
    const order = deleting;
    setDeletingBusy(true);
    try {
      await apiDelete(`/api/admin/orders/${order.id}`, {
        orderNumber: order.orderNumber,
        version: order.version,
      });
      setOrders((current) => current.filter((row) => row.id !== order.id));
      setTotal((current) => Math.max(0, current - 1));
      setStatusCounts((current) => ({
        ...current,
        [order.status]: Math.max(0, (current[order.status] ?? 0) - 1),
      }));
      setDeleting(null);
      window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT));
      toast.success(`Order #${order.orderNumber} deleted.`);
      await load(orders.length === 1 && page > 1 ? page - 1 : page);
      requestAnimationFrame(() => refreshButton.current?.focus());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete this order.");
      if (err instanceof ApiError && [404, 409].includes(err.status)) {
        setDeleting(null);
        await load(page);
        requestAnimationFrame(() => refreshButton.current?.focus());
      }
    } finally {
      setDeletingBusy(false);
    }
  };

  const printOrder = async (order: OrderDTO) => {
    const win = window.open("", "_blank", "width=420,height=720");
    if (!win) {
      toast.error("Allow pop-ups to print the order slip.");
      return;
    }
    // The slip builder pulls in a QR encoder, which is dead weight on a page
    // whose main job is the orders table — so it loads on the first print.
    const { buildReceiptHtml, printSlip } = await import("@/lib/receipt");

    const html = await buildReceiptHtml(order, {
      settings,
      money,
      origin: window.location.origin,
    });
    // Written into an opened window rather than printed from this document so
    // the admin layout, fonts and theme never leak onto the slip. printSlip
    // holds the print until the images have decoded.
    await printSlip(win, html);
  };

  return (
    <div>
      <PageHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"} matching your filters.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!orders.length || loading} title="Download orders on the current filtered page"
              onClick={() => downloadCsv(`cafe-orders-page-${page}.csv`,
                ["Order", "Customer", "Phone", "Total (PKR)", "Status", "Type", "Payment", "Placed at"],
                orders.map(order => [order.orderNumber, order.customerName, order.customerPhone, order.total,
                  ORDER_STATUS_LABEL[order.status], ORDER_TYPE_LABEL[order.orderType], order.paymentStatus, order.placedAt]))}>
              <Download className="h-4 w-4" aria-hidden /> Export page
            </Button>
            <Button ref={refreshButton} variant="secondary" onClick={() => void load(page)} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden /> Refresh
            </Button>
          </div>
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
                : "border-cream-300 bg-surface text-charcoal-600 hover:border-chai-300",
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
              // Every status, not just the next one — see allStatuses.
              const options = allStatuses(order.status, order.orderType);
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      {options.length > 0 && (
                        <select
                          aria-label={`Change status of order ${order.orderNumber}`}
                          disabled={updating === order.id}
                          value=""
                          onChange={(e) => {
                            if (e.target.value) void updateStatus(order, e.target.value as OrderStatus);
                          }}
                          className="rounded-lg border border-cream-300 bg-surface px-2 py-1.5 text-xs font-medium text-charcoal-700"
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
                        onClick={() => notifyCustomer(order)}
                        disabled={!toWhatsAppNumber(order.customerPhone)}
                        title={`WhatsApp ${order.customerName}: ${NOTIFY_LABEL[order.status]}`}
                        aria-label={`Send order ${order.orderNumber} status to ${order.customerName} on WhatsApp`}
                        className="rounded-lg p-1.5 text-charcoal-400 transition hover:bg-cream-100 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-charcoal-400"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void printOrder(order)}
                        aria-label={`Print order ${order.orderNumber}`}
                        className="rounded-lg p-1.5 text-charcoal-400 transition hover:bg-cream-100 hover:text-chai-600"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => requestDelete(order)}
                          disabled={updating === order.id || deletingBusy}
                          aria-label={`Delete order ${order.orderNumber}`}
                          title={`Delete order #${order.orderNumber}`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-chilli-500 transition hover:bg-chilli-400/10 hover:text-chilli-600 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      )}
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
              <Button
                size="sm"
                variant="secondary"
                disabled={!toWhatsAppNumber(viewing.customerPhone)}
                onClick={() => notifyCustomer(viewing)}
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp: {NOTIFY_LABEL[viewing.status]}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void printOrder(viewing)}>
                <Printer className="h-3.5 w-3.5" aria-hidden /> Print
              </Button>
              {canDelete && (
                <Button size="sm" variant="danger" disabled={updating === viewing.id || deletingBusy} onClick={() => requestDelete(viewing)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete order
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(deleting)}
        onClose={() => { if (!deletingBusy) setDeleting(null); }}
        title={deleting ? `Delete order #${deleting.orderNumber}?` : "Delete order"}
      >
        {deleting && (
          <div className="space-y-4">
            <div className="rounded-xl border border-cream-200 bg-cream-50 p-4 text-sm">
              <p className="font-semibold">{deleting.customerName}</p>
              <p className="mt-1 text-charcoal-500">{money(deleting.total)} · {ORDER_STATUS_LABEL[deleting.status]}</p>
            </div>
            <p className="text-sm text-charcoal-600">This permanently removes the order, its receipt and timeline from order history and reports. This cannot be undone here.</p>
            {deleting.status !== "DELIVERED" && deleting.status !== "CANCELLED" && (
              <p className="text-sm text-charcoal-600">Reserved stock for this unfinished order will be released.</p>
            )}
            <p className="text-xs text-charcoal-500">Deleting an order does not issue a payment refund.</p>
            <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-4">
              <Button variant="secondary" disabled={deletingBusy} onClick={() => setDeleting(null)}>Keep order</Button>
              <Button variant="danger" loading={deletingBusy} onClick={() => void confirmDelete()}>
                <Trash2 className="h-4 w-4" aria-hidden /> Delete order
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

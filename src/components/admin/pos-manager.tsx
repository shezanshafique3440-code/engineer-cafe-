"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { readOperations } from "@/server/operations";
import { apiGet, apiPost } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { posStore, type LocalBill, type PosPayload } from "@/lib/offline-pos";
import { useSession } from "@/context/session-context";
import { useSettings, useMoney } from "@/context/settings-context";
import { Button } from "@/components/ui";
import { PageHeader } from "./ui";
import { OperationForm, OperationsTable } from "./operations-ui";
import type { OrderDTO } from "@/server/orders";

type Bootstrap = Extract<
  Awaited<ReturnType<typeof readOperations>>,
  { shift: unknown }
>;
type Line = PosPayload["lines"][number];
const initial = (): PosPayload => ({
  clientId: crypto.randomUUID(),
  lines: [],
  orderType: "PICKUP",
  customerName: "Counter customer",
  customerPhone: "",
  shiftId: "",
  expectedTotal: 0,
  discount: 0,
  paid: false,
  paymentMethod: "CASH_AT_COUNTER",
});
export function PosManager() {
  const { user } = useSession();
  const ownerId = user?.id,
    ownerName = user?.name;
  const settings = useSettings(),
    money = useMoney();
  const [data, setData] = useState<Bootstrap | null>(null),
    [form, setForm] = useState<PosPayload | null>(null);
  const [bills, setBills] = useState<LocalBill[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState("");
  const [online, setOnline] = useState(true),
    [busy, setBusy] = useState(false),
    [quoted, setQuoted] = useState<number | null>(null),
    [editId, setEditId] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!ownerId) return;
    try {
      const d = await apiGet<Bootstrap>("/api/admin/operations/pos");
      setData(d);
      setError("");
      const store = await posStore();
      // Cache only counter menu/settings, cashier identity and active shift, never orders or other people's data.
      await store.snapshot({
        user: { id: ownerId, name: ownerName },
        data: { products: d.products, settings: d.settings, shift: d.shift },
        savedAt: new Date().toISOString(),
      });
      if (navigator.onLine) await store.sync(ownerId).catch(() => undefined);
      setBills(await store.list(ownerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load POS.");
    }
  }, [ownerId, ownerName]);
  useEffect(() => {
    setForm(initial());
    setOnline(navigator.onLine);
    void load();
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/pos-sw.js")
        .catch(() =>
          setNotice("Offline navigation unavailable; keep this tab open."),
        );
    const reconnect = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine && ownerId)
        void posStore()
          .then(async (s) => {
            await s.sync(ownerId);
            setBills(await s.list(ownerId));
            await load();
          })
          .catch((e) => setError(e.message));
    };
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", reconnect);
    return () => {
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", reconnect);
    };
  }, [load, ownerId]);
  useEffect(() => {
    setQuoted(null);
    if (!form?.lines.length || !online || form.discount) return;
    let active = true;
    const timer = setTimeout(() => {
      void apiPost<{ quote: { total: number } }>("/api/cart/quote", {
        lines: form.lines,
        couponCode: form.couponCode,
        orderType: form.orderType === "DINE_IN" ? "PICKUP" : form.orderType,
      })
        .then((r) => {
          if (active) setQuoted(r.quote.total);
        })
        .catch(() => undefined);
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form?.lines, form?.couponCode, form?.orderType, form?.discount, online]);
  const update = (patch: Partial<PosPayload>) =>
    setForm((f) => f && { ...f, ...patch });
  const changeLine = (index: number, patch: Partial<Line>) =>
    update({
      lines: form!.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    });
  const receipts = (form?.lines || []).map((l) => {
    const p = data?.products.find((p) => p.id === l.productId);
    const addons =
      p?.addonGroups
        .flatMap((x) => x.addonGroup.addons)
        .filter((a) => l.addonIds.includes(a.id)) || [];
    const unit = p
      ? p.discountPrice && p.discountPrice < p.price
        ? p.discountPrice
        : p.price
      : 0;
    return {
      name: p?.name || "Unavailable product",
      quantity: l.quantity,
      total: (unit + addons.reduce((s, a) => s + a.price, 0)) * l.quantity,
      options: addons.map((a) => a.name).join(", "),
    };
  });
  const subtotal = receipts.reduce((s, l) => s + l.total, 0),
    discount = form?.discount || 0;
  const delivery =
    form?.orderType === "DELIVERY" &&
    !(
      settings.freeDeliveryOver &&
      subtotal - discount >= settings.freeDeliveryOver
    )
      ? settings.deliveryFee
      : 0;
  const total =
    quoted ??
    subtotal -
      discount +
      Math.round(((subtotal - discount) * settings.taxPercent) / 100) +
      delivery;
  const sync = async () => {
    if (!user) return;
    try {
      const s = await posStore();
      await s.sync(user.id);
      setBills(await s.list(user.id));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    }
  };
  const save = async () => {
    if (!form || !user || !data?.shift) return;
    setBusy(true);
    setError("");
    try {
      const payload: PosPayload = {
        ...form,
        shiftId: data.shift.id,
        expectedTotal: total,
        paymentMethod:
          form.orderType === "DELIVERY" && !form.paid
            ? "CASH_ON_DELIVERY"
            : "CASH_AT_COUNTER",
      };
      if (editId) {
        await apiPost("/api/admin/operations/pos", {
          ...payload,
          action: "edit",
          orderId: editId,
        });
        setEditId(null);
        setForm(initial());
        setNotice("Order updated.");
        await load();
        return;
      }
      if (!online && form.couponCode)
        throw new Error(
          "Coupons require an online price check. Remove the coupon or reconnect.",
        );
      const store = await posStore();
      await store.queue(user.id, payload, {
        cafeName: settings.cafeName,
        lines: receipts,
      });
      if (online) await store.sync(user.id).catch(() => undefined);
      const all = await store.list(user.id);
      setBills(all);
      const bill = all.find((b) => b.id === payload.clientId)!;
      if (bill.state === "conflict") {
        setError(bill.error);
        return;
      }
      setNotice(
        bill.order
          ? `Order ${bill.order.orderNumber} saved.`
          : "Provisional bill saved on this device. Keep cash/bill for reconciliation until synchronized.",
      );
      setForm(initial());
      if (online) await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save bill.");
    } finally {
      setBusy(false);
    }
  };
  const mutate = async (body: Record<string, unknown>) => {
    await apiPost("/api/admin/operations/pos", body);
    await load();
  };
  const print = async (order: OrderDTO) => {
    const win = window.open("", "_blank");
    if (!win) return setError("Allow popups to print.");
    try {
      const { buildReceiptHtml, printSlip } = await import("@/lib/receipt");
      await printSlip(
        win,
        await buildReceiptHtml(order, {
          settings,
          money,
          origin: location.origin,
        }),
      );
    } catch {
      win.close();
      setError("Unable to print receipt.");
    }
  };
  if (!form) return <p>Loading counter…</p>;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Point of sale"
        description="Dine-in, takeaway and delivery · cashier billing & payments"
      />
      <div className="surface flex flex-wrap items-center gap-4 p-4 text-sm">
        <strong>{online ? "Online" : "Offline · provisional billing"}</strong>
        <span>
          {data?.shift
            ? `Your shift is open · ${user?.name}`
            : "Open your shift before billing."}
        </span>
        <Link className="underline" href="/admin/shifts">
          Manage shifts
        </Link>
        <a className="underline" href="/pos-offline.html">
          Offline counter
        </a>
        <button className="underline" onClick={() => void sync()}>
          Sync local bills
        </button>
        <button className="underline" onClick={() => void load()}>
          Refresh menu
        </button>
      </div>
      {error && (
        <p className="surface p-4 text-chilli-600" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_1.2fr]">
        <section className="surface p-4">
          <h2 className="font-bold">Menu</h2>
          <input
            className="field my-3"
            aria-label="Search POS menu"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="grid max-h-[32rem] grid-cols-2 gap-2 overflow-auto">
            {data?.products
              .filter((p) =>
                p.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((p) => (
                <button
                  type="button"
                  className="rounded-xl border border-cream-300 p-3 text-left hover:border-chai-500"
                  key={p.id}
                  onClick={() =>
                    update({
                      lines: [
                        ...form.lines,
                        {
                          productId: p.id,
                          quantity: 1,
                          addonIds: p.addonGroups.flatMap((x) =>
                            x.addonGroup.addons
                              .filter((a) => a.isDefault)
                              .map((a) => a.id),
                          ),
                        },
                      ],
                    })
                  }
                >
                  <strong className="block text-sm">{p.name}</strong>
                  <span className="text-xs">
                    {p.category.name} ·{" "}
                    {money(
                      p.discountPrice && p.discountPrice < p.price
                        ? p.discountPrice
                        : p.price,
                    )}
                  </span>
                </button>
              ))}
          </div>
        </section>
        <section className="surface space-y-4 p-4">
          <h2 className="font-bold">
            {editId ? "Edit unpaid order" : "New bill"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid text-sm">
              Order type
              <select
                className="field"
                value={form.orderType}
                onChange={(e) =>
                  update({
                    orderType: e.target.value as PosPayload["orderType"],
                  })
                }
              >
                <option value="PICKUP">Takeaway / pickup</option>
                <option value="DINE_IN">Dine-in</option>
                <option value="DELIVERY">Delivery</option>
              </select>
            </label>
            <label className="grid text-sm">
              Table number
              <input
                className="field"
                value={form.tableNumber || ""}
                onChange={(e) => update({ tableNumber: e.target.value })}
              />
            </label>
            <label className="grid text-sm">
              Customer
              <input
                className="field"
                value={form.customerName}
                onChange={(e) => update({ customerName: e.target.value })}
              />
            </label>
            <label className="grid text-sm">
              Phone
              <input
                className="field"
                value={form.customerPhone}
                onChange={(e) => update({ customerPhone: e.target.value })}
              />
            </label>
            {form.orderType === "DELIVERY" && (
              <label className="grid text-sm sm:col-span-2">
                Delivery address
                <input
                  className="field"
                  value={form.addressLine || ""}
                  onChange={(e) => update({ addressLine: e.target.value })}
                />
              </label>
            )}
          </div>
          {form.lines.map((line, i) => {
            const p = data?.products.find((p) => p.id === line.productId);
            return (
              <div
                className="space-y-2 rounded-xl border border-cream-300 p-3"
                key={i}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">
                    {p?.name || "Unavailable product"}
                  </strong>
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() =>
                      update({ lines: form.lines.filter((_, j) => i !== j) })
                    }
                  >
                    Remove
                  </button>
                </div>
                <label className="grid text-sm">
                  Quantity
                  <input
                    className="field"
                    type="number"
                    min="1"
                    max="50"
                    value={line.quantity}
                    onChange={(e) =>
                      changeLine(i, { quantity: Number(e.target.value) })
                    }
                  />
                </label>
                {p?.addonGroups.map(({ addonGroup: g }) => (
                  <label key={g.id} className="grid text-sm">
                    {g.name}
                    {g.isRequired ? " (required)" : ""}
                    <select
                      className="field"
                      multiple={g.type === "MULTIPLE"}
                      value={
                        g.type === "MULTIPLE"
                          ? line.addonIds.filter((a) =>
                              g.addons.some((x) => x.id === a),
                            )
                          : line.addonIds.find((a) =>
                              g.addons.some((x) => x.id === a),
                            ) || ""
                      }
                      onChange={(e) =>
                        changeLine(i, {
                          addonIds: [
                            ...line.addonIds.filter(
                              (a) => !g.addons.some((x) => x.id === a),
                            ),
                            ...Array.from(e.target.selectedOptions)
                              .map((o) => o.value)
                              .filter(Boolean),
                          ],
                        })
                      }
                    >
                      {!g.isRequired && g.type === "SINGLE" && (
                        <option value="">None</option>
                      )}
                      {g.addons.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (+{money(a.price)})
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <span className="text-sm">{money(receipts[i].total)}</span>
              </div>
            );
          })}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid text-sm">
              Coupon
              <input
                className="field"
                value={form.couponCode || ""}
                onChange={(e) => update({ couponCode: e.target.value })}
              />
            </label>
            {can(user, "promotions") && (
              <label className="grid text-sm">
                Manual discount (Rs.)
                <input
                  className="field"
                  type="number"
                  min="0"
                  value={form.discount}
                  onChange={(e) => update({ discount: Number(e.target.value) })}
                />
              </label>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={Boolean(editId)}
              checked={form.paid}
              onChange={(e) => update({ paid: e.target.checked })}
            />
            Cash actually received now
          </label>
          <p className="text-lg font-extrabold">Total {money(total)}</p>
          <p className="text-xs text-charcoal-500">
            Server validates prices and stock. Offline bills are provisional.
            Keep local data on this device until every bill is confirmed.
          </p>
          <div className="flex gap-3">
            <Button
              loading={busy}
              disabled={
                !data?.shift || !form.lines.length || !Number.isFinite(total)
              }
              onClick={() => void save()}
            >
              {editId ? "Save changes" : "Save bill"}
            </Button>
            <button
              className="text-sm underline"
              onClick={() => {
                setEditId(null);
                setForm(initial());
              }}
            >
              Clear editor
            </button>
          </div>
        </section>
      </div>
      <OperationsTable
        title="Local bill queue"
        headers={["Bill", "Amount", "Status", "Details", "Actions"]}
        rows={bills.map((b) => [
          b.order?.orderNumber || b.id.slice(0, 8),
          money(b.payload.expectedTotal),
          b.state,
          b.error ||
            (b.order ? b.order.paymentStatus : "Awaiting server confirmation"),
          <div className="flex flex-wrap gap-3" key={b.id}>
            <button
              className="underline"
              onClick={() =>
                void posStore()
                  .then((s) => s.print(b))
                  .catch((e) => setError(e.message))
              }
            >
              Print
            </button>
            {b.state === "conflict" && (
              <>
                <button
                  className="underline"
                  onClick={() => {
                    setForm({
                      ...b.payload,
                      shiftId: data?.shift?.id || b.payload.shiftId,
                    });
                    setEditId(null);
                    setNotice(
                      "Review prices, shift and stock, then save this same bill ID again.",
                    );
                    window.scrollTo(0, 0);
                  }}
                >
                  Review & correct
                </button>
                <button
                  className="underline"
                  onClick={() => {
                    if (
                      !confirm(
                        "Void this unconfirmed local bill? Reconcile any cash collected before continuing.",
                      )
                    )
                      return;
                    void posStore().then(async (s) => {
                      await s.discard(user!.id, b.id);
                      setBills(await s.list(user!.id));
                    });
                  }}
                >
                  Void local bill
                </button>
              </>
            )}
          </div>,
        ])}
      />
      {data && (
        <OperationForm
          spec={{
            title: "Record payment / refund",
            action: "payment",
            fields: [
              {
                name: "orderId",
                label: "Order",
                type: "select",
                options: data.orders.map((o) => ({
                  value: o.id,
                  label: `${o.orderNumber} · ${o.paymentStatus} · ${money(o.total)}`,
                })),
              },
              {
                name: "shiftId",
                label: "My open shift",
                type: "select",
                options: data.shift
                  ? [{ value: data.shift.id, label: "Current shift" }]
                  : [],
              },
              { name: "reference", label: "Unique receipt reference" },
              {
                name: "refund",
                label: "Full refund (finance permission required)",
                type: "checkbox",
              },
            ],
            hint: "Confirm actual cash collection. Refunds are recorded as negative drawer entries; cancel the order after refunding to restore stock.",
          }}
          submit={mutate}
        />
      )}
      {data && (
        <OperationsTable
          title="Recent orders"
          headers={[
            "Order",
            "Type",
            "Customer",
            "Status",
            "Payment",
            "Amount",
            "Actions",
          ]}
          rows={data.orders.map((o) => [
            o.orderNumber,
            `${o.orderType}${o.tableNumber ? ` · table ${o.tableNumber}` : ""}`,
            o.customerName,
            o.status,
            o.paymentStatus,
            money(o.total),
            <div className="flex flex-wrap gap-3" key={o.id}>
              <button className="underline" onClick={() => void print(o)}>
                Print
              </button>
              {o.source === "POS" &&
                o.paymentStatus === "UNPAID" &&
                ["PENDING", "CONFIRMED"].includes(o.status) && (
                  <button
                    className="underline"
                    onClick={() => {
                      setEditId(o.id);
                      setForm({
                        ...initial(),
                        orderType: o.orderType,
                        customerName: o.customerName,
                        customerPhone: o.customerPhone,
                        addressLine: o.addressLine || "",
                        tableNumber: o.tableNumber || "",
                        couponCode: o.couponCode || "",
                        discount: o.couponCode ? 0 : o.discount,
                        lines: o.items.map((l) => ({
                          productId: l.productId!,
                          quantity: l.quantity,
                          addonIds: l.addons
                            .map((a) => a.addonId!)
                            .filter(Boolean),
                        })),
                      });
                      window.scrollTo(0, 0);
                    }}
                  >
                    Edit
                  </button>
                )}
              {o.orderType !== "DELIVERY" &&
                !["DELIVERED", "CANCELLED"].includes(o.status) &&
                o.paymentStatus === "PAID" && (
                  <button
                    className="underline"
                    onClick={() =>
                      void mutate({ action: "complete", orderId: o.id }).catch(
                        (e) => setError(e.message),
                      )
                    }
                  >
                    Hand over & complete
                  </button>
                )}
              {o.source === "POS" &&
                !["CANCELLED", "DELIVERED"].includes(o.status) &&
                o.paymentStatus !== "PAID" && (
                  <button
                    className="underline"
                    onClick={() => {
                      if (confirm(`Cancel ${o.orderNumber} and restore stock?`))
                        void mutate({ action: "cancel", orderId: o.id }).catch(
                          (e) => setError(e.message),
                        );
                    }}
                  >
                    Cancel
                  </button>
                )}
            </div>,
          ])}
        />
      )}
    </div>
  );
}

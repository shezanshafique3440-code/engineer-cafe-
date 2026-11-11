"use client";
import { useState } from "react";
import { apiPut } from "@/lib/api-client";
import { Button, Input } from "@/components/ui";
import { useMoney } from "@/context/settings-context";
import type { OrderDTO } from "@/server/orders";
export function EditOrderForm({
  order,
  onSaved,
}: {
  order: OrderDTO;
  onSaved: (order: OrderDTO) => void;
}) {
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState(
    order.items.map((i) => ({
      productId: i.productId || "",
      name: i.productName,
      quantity: i.quantity,
      addonIds: i.addons.map((a) => a.addonId || ""),
      notes: i.notes || "",
    })),
  );
  const [total, setTotal] = useState<number | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Edit unpaid bill
      </Button>
    );
  const submit = async (preview: boolean) => {
    setBusy(true);
    setMessage("");
    try {
      const result = await apiPut<{
        quote?: { total: number };
        order?: OrderDTO;
      }>(`/api/admin/orders/${order.id}`, {
        requestId,
        version: order.version,
        preview,
        ...(preview ? {} : { expectedTotal: total }),
        lines: lines
          .filter((l) => l.quantity > 0)
          .map(({ name: _name, ...line }) => line),
      });
      if (result.order) onSaved(result.order);
      else if (result.quote) setTotal(result.quote.total);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not edit bill.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border border-chai-300 p-4 space-y-4">
      <h3 className="font-bold">Edit unpaid bill</h3>
      <p className="text-sm text-charcoal-600">
        Adjust quantities or kitchen notes. Set quantity to 0 to remove an item.
        Preview recalculates current menu prices; no changes are saved until you
        confirm.
      </p>
      {lines.map((line, index) => (
        <div key={index} className="grid gap-3 sm:grid-cols-[1fr_100px_1fr]">
          <span className="self-center text-sm font-semibold">{line.name}</span>
          <Input
            label="Quantity"
            type="number"
            min={0}
            max={50}
            value={line.quantity}
            disabled={busy}
            onChange={(e) => {
              setTotal(null);
              setLines(
                lines.map((l, i) =>
                  i === index ? { ...l, quantity: Number(e.target.value) } : l,
                ),
              );
            }}
          />
          <Input
            label="Kitchen note"
            maxLength={200}
            value={line.notes}
            disabled={busy}
            onChange={(e) => {
              setTotal(null);
              setLines(
                lines.map((l, i) =>
                  i === index ? { ...l, notes: e.target.value } : l,
                ),
              );
            }}
          />
        </div>
      ))}
      {message && (
        <p role="alert" className="text-sm text-chilli-600">
          {message}
        </p>
      )}
      {total !== null && (
        <p className="font-bold">Revised total: {money(total)}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button loading={busy} onClick={() => void submit(total === null)}>
          {total === null ? "Preview revised bill" : "Confirm & save changes"}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
          Keep original bill
        </Button>
      </div>
    </section>
  );
}

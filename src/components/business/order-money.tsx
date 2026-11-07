"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { Button, Input, Select } from "@/components/ui";
import type { OrderDTO } from "@/server/orders";
export function OrderMoney({
  order,
  onDone,
}: {
  order: OrderDTO;
  onDone: () => void;
}) {
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]),
    [account, setAccount] = useState(""),
    [amount, setAmount] = useState(
      order.status === "CANCELLED" ? order.refundDue : order.remainingDue,
    ),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef<{ payload: string; id: string } | null>(null);
  useEffect(() => {
    void apiGet<{ accounts: { id: string; name: string }[] }>(
      "/api/admin/sales-context",
    )
      .then((d) => setAccounts(d.accounts))
      .catch(() => setError("Could not load payment accounts."));
  }, []);
  if (!order.businessTracked) return null;
  const refund = order.status === "CANCELLED";
  return (
    <form
      className="mt-5 rounded-xl border border-cream-200 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        const payload = {
            orderId: order.id,
            amount,
            accountId: account,
            note,
            refund,
          },
          hash = JSON.stringify(payload);
        if (key.current?.payload !== hash)
          key.current = { payload: hash, id: crypto.randomUUID() };
        try {
          await apiPost("/api/admin/order-payments", {
            ...payload,
            requestId: key.current!.id,
          });
          toast.success(refund ? "Refund recorded." : "Payment recorded.");
          key.current = null;
          onDone();
        } catch (e) {
          const m =
            e instanceof ApiError && e.fields
              ? Object.values(e.fields).flat()[0] || e.message
              : e instanceof Error
                ? e.message
                : "Could not record payment";
          setError(m);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="text-sm font-bold">
        {refund ? "Record actual refund" : "Receive payment"}
      </h3>
      <p className="mt-1 text-xs text-charcoal-500">
        Received: Rs. {order.amountPaid} · Refunded: Rs. {order.amountRefunded}{" "}
        ·{" "}
        {refund
          ? "Refund due: Rs. " + order.refundDue
          : "Balance: Rs. " + order.remainingDue}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Input
          label="Amount (Rs.)"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          required
          onChange={(e) => setAmount(e.target.value)}
        />
        <Select
          label={refund ? "Refund from" : "Received into"}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          required
        >
          <option value="">Choose…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <div className="sm:col-span-2">
          <Input
            label="Reference / reason"
            value={note}
            required
            minLength={3}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-chilli-600">
          {error}
        </p>
      )}
      <Button
        className="mt-3"
        type="submit"
        loading={busy}
        disabled={Number(refund ? order.refundDue : order.remainingDue) <= 0}
      >
        {refund ? "Confirm actual refund" : "Record receipt"}
      </Button>
    </form>
  );
}

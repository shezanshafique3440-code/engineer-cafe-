"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { Button, Input, Select } from "@/components/ui";
import { useSession } from "@/context/session-context";
import { Form, rows, text, type Row } from "./shared";
import type { OrderDTO } from "@/server/orders";
export function OrderMoney({
  order,
  onDone,
}: {
  order: OrderDTO;
  onDone: () => void;
}) {
  const { user } = useSession();
  const [approvals, setApprovals] = useState<Row[]>([]),
    [approvalId, setApprovalId] = useState("");
  const loadApprovals = useCallback(
    () =>
      apiGet<Row>("/api/admin/business/approvals").then((d) =>
        setApprovals(
          rows(d, "approvals").filter(
            (a) =>
              a.requestedById === user?.id &&
              a.kind === "REFUND" &&
              a.orderId === order.id &&
              a.status === "APPROVED" &&
              new Date(text(a, "expiresAt")) > new Date(),
          ),
        ),
      ),
    [order.id, user?.id],
  );
  const [accounts, setAccounts] = useState<
      { id: string; name: string; code: string }[]
    >([]),
    [account, setAccount] = useState(""),
    [amount, setAmount] = useState(
      order.status === "CANCELLED" ? order.refundDue : order.remainingDue,
    ),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef<{ payload: string; id: string } | null>(null);
  useEffect(() => {
    void loadApprovals().catch(() => {});
    void apiGet<{ accounts: { id: string; name: string; code: string }[] }>(
      "/api/admin/sales-context",
    )
      .then((d) =>
        setAccounts(
          /^(cafe-demo-v[12]-|cafe-practice-v1-)/.test(order.id)
            ? d.accounts.filter(
                (a) =>
                  a.code.startsWith(
                    order.id.startsWith("cafe-demo-v2-") ? "DEMO2_" : "DEMO_",
                  ) || a.code === "RIDER_CASH",
              )
            : d.accounts,
        ),
      )
      .catch(() => setError("Could not load payment accounts."));
  }, [loadApprovals, order.id]);
  if (!order.businessTracked) return null;
  const refund = order.status === "CANCELLED";
  return (
    <div>
      {order.status === "CANCELLED" && user?.role !== "ADMIN" && (
        <details className="mt-4 rounded-xl border border-cream-200 p-3">
          <summary className="cursor-pointer font-bold">
            Request refund approval
          </summary>
          <Form
            title="Refund approval request"
            module="approvals"
            fields={[
              {
                name: "amount",
                label: "Refund requested (Rs.)",
                type: "number",
                min: "0.01",
                value: order.refundDue,
              },
              { name: "reason", label: "Refund reason" },
            ]}
            build={(v) => ({
              ...v,
              action: "REQUEST",
              kind: "REFUND",
              orderId: order.id,
            })}
            onDone={() =>
              toast.success("Sent for review in Cafe office → Approvals.")
            }
            submitLabel="Send for review"
          />
        </details>
      )}
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
              approvalId: refund ? approvalId || undefined : undefined,
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
          Received: Rs. {order.amountPaid} · Refunded: Rs.{" "}
          {order.amountRefunded} ·{" "}
          {refund
            ? "Refund due: Rs. " + order.refundDue
            : "Balance: Rs. " + order.remainingDue}
        </p>
        {refund && user?.role !== "ADMIN" && (
          <div className="mt-3 space-y-3">
            <Select
              label="Approved refund"
              required
              value={approvalId}
              onChange={(e) => {
                setApprovalId(e.target.value);
                const a = approvals.find((a) => a.id === e.target.value);
                if (a) setAmount(text(a, "amount"));
              }}
            >
              <option value="">Choose approval…</option>
              {approvals.map((a) => (
                <option key={text(a, "id")} value={text(a, "id")}>
                  Rs. {text(a, "amount")} · {text(a, "reason")}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                void loadApprovals().catch((e) => setError(e.message))
              }
            >
              Refresh approvals
            </Button>
          </div>
        )}
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
    </div>
  );
}

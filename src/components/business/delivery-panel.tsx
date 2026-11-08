"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Form,
  Table,
  Cell,
  Stat,
  Notice,
  rows,
  text,
  money,
  day,
  object,
  type Row,
  type Field,
} from "./shared";
import { useSession } from "@/context/session-context";
import { canBusiness } from "@/lib/business-access";
import { apiPatch } from "@/lib/api-client";
import { downloadCsv } from "@/lib/csv";
import { Button } from "@/components/ui";
export function DeliveryPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const { user } = useSession();
  const riders = rows(data, "riders"),
    orders = rows(data, "orders"),
    totals = object(data, "totals");
  const [editing, setEditing] = useState<Row | null>(null),
    [error, setError] = useState("");
  const riderOptions = riders.map((r) => ({
    value: text(r, "id"),
    label: `${text(r, "code")} · ${text(r, "party.name")}${r.isActive ? "" : " (inactive)"}`,
  }));
  const accounts = rows(data, "accounts").map((a) => ({
    value: text(a, "id"),
    label: text(a, "name"),
  }));
  const reason: Field = { name: "note", label: "Reason / reference" };
  const paymentFields: Field[] = [
    { name: "riderId", label: "Rider", type: "select", options: riderOptions },
    {
      name: "accountId",
      label: "Cash / bank / wallet account",
      type: "select",
      options: accounts,
    },
    {
      name: "amount",
      label: "Actual amount (Rs.)",
      type: "number",
      min: "0.01",
      step: "0.01",
    },
    reason,
  ];
  const changeStatus = async (order: Row, status: string) => {
    setError("");
    try {
      await apiPatch("/api/admin/orders/" + text(order, "id"), {
        status,
        note: "Delivery desk: " + status,
      });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed.");
    }
  };
  const done = () => {
    setEditing(null);
    reload();
  };
  return (
    <div className="space-y-5">
      <Notice>
        Commission is 15% of the food amount after all discounts, excluding tax
        and delivery fees, rounded to the nearest paisa. It accrues once on
        completed delivery. Cancellation reverses the commission; recorded
        payouts remain visible. A negative due is a recoverable overpayment.
        Balances are current; earnings, payouts and performance use the selected
        date range.
      </Notice>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Commission earned" value={totals.earned} />
        <Stat label="Reversed" value={totals.reversed} />
        <Stat label="Paid" value={totals.paid} />
        <Stat label="Commission due" value={totals.due} />
        <Stat label="Cash with riders" value={totals.cashHeld} />
      </div>
      {Number(totals.unattributedCash) !== 0 && (
        <Notice>
          Rider cash control differs from individually attributed cash by{" "}
          {money(totals.unattributedCash)}. Older or manually transferred cash
          needs owner reconciliation; this release does not assign historical
          balances to riders.
        </Notice>
      )}
      {error && (
        <p role="alert" className="text-chilli-600">
          {error}
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Form
          key={text(editing ?? undefined, "id", "new")}
          title={editing ? "Edit rider" : "Add rider"}
          module="delivery"
          fields={[
            {
              name: "code",
              label: "Unique rider code",
              value: text(editing ?? undefined, "code"),
            },
            {
              name: "name",
              label: "Rider name",
              value: text(editing ?? undefined, "party.name"),
            },
            {
              name: "phone",
              label: "Phone",
              value: text(editing ?? undefined, "party.phone"),
            },
            {
              name: "isActive",
              label: "Active",
              type: "checkbox",
              value: editing ? Boolean(editing.isActive) : true,
            },
          ]}
          build={(v) => ({
            ...v,
            action: "SAVE",
            id: editing?.id,
            version: editing?.version,
          })}
          onDone={done}
        />
        <Form
          title="Assign delivery"
          module="delivery"
          fields={[
            {
              name: "orderId",
              label: "Unsent delivery order",
              type: "select",
              options: orders
                .filter(
                  (o) =>
                    !["DELIVERED", "CANCELLED", "OUT_FOR_DELIVERY"].includes(
                      text(o, "status"),
                    ),
                )
                .map((o) => ({
                  value: text(o, "id"),
                  label: `${text(o, "orderNumber")} · ${text(o, "customerName")}`,
                })),
            },
            {
              name: "riderId",
              label: "Active rider",
              type: "select",
              options: riderOptions.filter(
                (r) => riders.find((row) => row.id === r.value)?.isActive,
              ),
            },
            reason,
          ]}
          build={(v) => ({
            ...v,
            action: "ASSIGN",
            version: orders.find((o) => o.id === v.orderId)?.version,
          })}
          onDone={reload}
        />
        <Form
          title="Receive rider cash"
          module="delivery"
          description="Record cash actually handed into the selected drawer/bank/wallet. This transfers existing money; it is not a second sale."
          fields={paymentFields
            .filter((f) => f.name !== "accountId")
            .concat([
              {
                name: "accountId",
                label: "Receiving account",
                type: "select",
                options: accounts.filter(
                  (a) =>
                    rows(data, "accounts").find((r) => r.id === a.value)
                      ?.code !== "RIDER_CASH",
                ),
              },
            ])}
          build={(v) => ({ ...v, action: "REMIT" })}
          disabled={!canBusiness(user, "payments")}
          onDone={reload}
        />
        {canBusiness(user, "finance") && (
          <Form
            title="Commission payout / recovery"
            module="delivery"
            description="Pay only the outstanding commission. For a negative due after cancellation, record an actual cash recovery. Rider cash can fund a payout only up to that rider's recorded cash held."
            fields={[
              {
                name: "action",
                label: "Action",
                type: "select",
                value: "SETTLE",
                options: [
                  { value: "SETTLE", label: "Pay commission" },
                  { value: "RECOVER", label: "Receive overpayment recovery" },
                ],
              },
              ...paymentFields,
            ]}
            build={(v) => ({ ...v })}
            onDone={reload}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv(
              "rider-commission-" + text(data, "from") + ".csv",
              [
                "Code",
                "Rider",
                "Delivered",
                "Active",
                "Average minutes",
                "Earned",
                "Reversed",
                "Paid",
                "Recovered",
                "Current due",
                "Cash held",
              ],
              riders.map((r) =>
                [
                  "code",
                  "party.name",
                  "delivered",
                  "active",
                  "averageMinutes",
                  "earned",
                  "reversed",
                  "paid",
                  "recovered",
                  "due",
                  "cashHeld",
                ].map((key) => text(r, key)),
              ),
            )
          }
        >
          Export rider report
        </Button>
        <Link className="btn-secondary" href="/admin/orders?orderType=DELIVERY">
          All delivery orders
        </Link>
      </div>
      <Table
        headers={[
          "Rider",
          "Phone",
          "Delivered / active",
          "Average minutes",
          "Earned / reversed",
          "Paid / recovered",
          "Current due",
          "Cash held",
          "Actions",
        ]}
        empty={!riders.length}
      >
        {riders.map((r) => (
          <tr key={text(r, "id")}>
            <Cell>
              {text(r, "code")} · {text(r, "party.name")}
              {r.isActive ? "" : " (inactive)"}
            </Cell>
            <Cell>{text(r, "party.phone")}</Cell>
            <Cell>
              {text(r, "delivered")} / {text(r, "active")}
            </Cell>
            <Cell>{text(r, "averageMinutes", "—")}</Cell>
            <Cell>
              {money(r.earned)} / {money(r.reversed)}
            </Cell>
            <Cell>
              {money(r.paid)} / {money(r.recovered)}
            </Cell>
            <Cell>{money(r.due)}</Cell>
            <Cell>{money(r.cashHeld)}</Cell>
            <Cell>
              <button
                className="font-bold underline"
                onClick={() => {
                  setEditing(r);
                  window.scrollTo(0, 0);
                }}
              >
                Edit
              </button>
            </Cell>
          </tr>
        ))}
      </Table>
      <h2 className="text-lg font-bold">
        Active and recently completed deliveries (latest 300)
      </h2>
      <Table
        headers={[
          "Order",
          "Customer / address",
          "Rider",
          "Status",
          "Payment",
          "Commission",
          "Actions",
        ]}
        empty={!orders.length}
      >
        {orders.map((o) => (
          <tr key={text(o, "id")}>
            <Cell>
              {text(o, "orderNumber")} · {money(o.total)}
            </Cell>
            <Cell>
              {text(o, "customerName")}
              <br />
              {text(o, "customerPhone")}
              <br />
              {text(o, "addressLine")}
            </Cell>
            <Cell>{text(o, "riderName", "Unassigned")}</Cell>
            <Cell>{text(o, "status")}</Cell>
            <Cell>{text(o, "paymentStatus")}</Cell>
            <Cell>
              {text(o, "commission.amount")
                ? money(text(o, "commission.amount"))
                : "Accrues on delivery"}
            </Cell>
            <Cell>
              <div className="flex flex-wrap gap-2">
                {canBusiness(user, "orders") &&
                  canBusiness(user, "payments") &&
                  !["CANCELLED", "DELIVERED"].includes(text(o, "status")) &&
                  ([
                    "PENDING",
                    "CONFIRMED",
                    "PREPARING",
                    "READY",
                    "OUT_FOR_DELIVERY",
                  ].includes(text(o, "status"))
                    ? [
                        text(o, "status") === "PENDING"
                          ? "CONFIRMED"
                          : text(o, "status") === "CONFIRMED"
                            ? "PREPARING"
                            : text(o, "status") === "PREPARING"
                              ? "READY"
                              : text(o, "status") === "READY"
                                ? "OUT_FOR_DELIVERY"
                                : "DELIVERED",
                      ]
                    : []
                  ).map((s) => (
                    <button
                      key={s}
                      className="font-bold underline"
                      onClick={() => void changeStatus(o, s)}
                    >
                      {s.replaceAll("_", " ")}
                    </button>
                  ))}
                <Link
                  className="underline"
                  href={
                    "/admin/orders?search=" +
                    encodeURIComponent(text(o, "orderNumber"))
                  }
                >
                  View order
                </Link>
              </div>
            </Cell>
          </tr>
        ))}
      </Table>
      <h2 className="text-lg font-bold">
        Commission payments, recoveries and cash remittances
      </h2>
      <Table
        headers={["Date", "Rider", "Type", "Amount", "Account", "Reference"]}
        empty={!riders.some((r) => rows(r, "transfers").length)}
      >
        {riders.flatMap((r) =>
          rows(r, "transfers").map((t) => (
            <tr key={text(t, "id")}>
              <Cell>{day(t.date)}</Cell>
              <Cell>{text(r, "code")}</Cell>
              <Cell>{text(t, "kind")}</Cell>
              <Cell>{money(t.amount)}</Cell>
              <Cell>{text(t, "account.name")}</Cell>
              <Cell>{text(t, "note")}</Cell>
            </tr>
          )),
        )}
      </Table>
    </div>
  );
}

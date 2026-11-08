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
    [error, setError] = useState(""),
    [task, setTask] = useState(riders.length ? "assign" : "profile"),
    [selectedRider, setSelectedRider] = useState(""),
    [busyOrder, setBusyOrder] = useState(""),
    [selectedOrder, setSelectedOrder] = useState("");
  const showTask = (id: string) => {
    setTask(id);
    setTimeout(
      () =>
        document
          .getElementById("delivery-action-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };
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
    {
      name: "riderId",
      label: "Rider",
      type: "select",
      options: riderOptions,
      value: selectedRider,
    },
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
    if (busyOrder) return;
    if (
      status === "DELIVERED" &&
      !window.confirm(
        Number(order.remainingDue) > 0 &&
          !order.businessCredit &&
          order.paymentMethod !== "ONLINE"
          ? `#${text(order, "orderNumber")}: Delivery ho gayi aur customer se baqi ${money(order.remainingDue)} cash mil gaya? Confirm par receipt aur commission record hogi.`
          : `#${text(order, "orderNumber")}: Delivery complete ho gayi?`,
      )
    )
      return;
    setBusyOrder(text(order, "id"));
    setError("");
    try {
      await apiPatch("/api/admin/orders/" + text(order, "id"), {
        status,
        note: "Delivery desk: " + status,
      });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed.");
    } finally {
      setBusyOrder("");
    }
  };
  const done = () => {
    setEditing(null);
    reload();
  };
  return (
    <div className="space-y-5">
      <details className="surface p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">
          Commission ka rule / Details
        </summary>
        <p className="mt-2 text-sm">
          Net food amount (discount ke baad) ka 15% commission delivery complete
          hone par banta hai. Tax aur delivery fee shamil nahi. Cancellation par
          commission reverse hoti hai; actual payouts history mein rehte hain.
          Negative due rider se recover karna hai. Balances current hain;
          earned/paid selected dates ke hain.
        </p>
      </details>
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
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Rider balances"
      >
        {riders.map((r) => (
          <article className="surface p-4" key={text(r, "id")}>
            <h2 className="text-lg font-bold">{text(r, "party.name")}</h2>
            <p className="text-sm text-charcoal-500">
              {text(r, "code")} · {r.isActive ? "Active" : "Inactive"}
            </p>
            <dl className="my-3 space-y-2">
              <div className="flex justify-between gap-2">
                <dt>Rider ke paas cash</dt>
                <dd className="font-bold">{money(r.cashHeld)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>
                  {Number(r.due) < 0 ? "Wapas lena hai" : "Commission deni hai"}
                </dt>
                <dd className="font-bold">{money(Math.abs(Number(r.due)))}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              {canBusiness(user, "payments") && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelectedRider(text(r, "id"));
                    showTask("cash");
                  }}
                >
                  Cash jama
                </Button>
              )}
              {canBusiness(user, "finance") && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelectedRider(text(r, "id"));
                    showTask("payout");
                  }}
                >
                  Commission / Recovery
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditing(r);
                  showTask("profile");
                }}
              >
                Edit rider
              </Button>
            </div>
          </article>
        ))}
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Rider ka kaam"
      >
        {[
          { id: "assign", label: "1. Delivery dein" },
          { id: "cash", label: "2. Cash jama" },
          ...(canBusiness(user, "finance")
            ? [{ id: "payout", label: "3. Commission dein" }]
            : []),
          { id: "profile", label: "Rider add / edit" },
        ].map((t) => (
          <button
            type="button"
            key={t.id}
            aria-pressed={task === t.id}
            className={
              task === t.id ? "btn-primary min-h-11" : "btn-secondary min-h-11"
            }
            onClick={() => showTask(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="delivery-action-form" className="min-w-0 scroll-mt-24">
        {task === "profile" && (
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
        )}
        {task === "assign" && (
          <Form
            key={"assign:" + selectedOrder}
            title="Assign delivery"
            module="delivery"
            fields={[
              {
                name: "orderId",
                label: "Unsent delivery order",
                type: "select",
                value: selectedOrder,
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
        )}
        {task === "cash" && (
          <Form
            key={"cash:" + selectedRider}
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
        )}
        {task === "payout" && canBusiness(user, "finance") && (
          <Form
            key={"payout:" + selectedRider}
            title="Commission payout / recovery"
            module="delivery"
            description="Pay only the outstanding commission. For a negative due after cancellation, record an actual cash recovery. Rider cash can fund a payout only up to that rider's recorded cash held."
            fields={[
              {
                name: "action",
                label: "Action",
                type: "select",
                value:
                  Number(riders.find((r) => r.id === selectedRider)?.due) < 0
                    ? "RECOVER"
                    : "SETTLE",
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
      <details className="surface p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-bold">
          Detailed rider performance report
        </summary>
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
                    showTask("profile");
                    window.scrollTo(0, 0);
                  }}
                >
                  Edit
                </button>
              </Cell>
            </tr>
          ))}
        </Table>
      </details>
      <h2 className="text-lg font-bold">
        Active and recently completed deliveries (latest 300)
      </h2>
      <section aria-label="Active deliveries">
        <h2 className="mb-3 text-xl font-bold">Delivery orders / Agla kaam</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orders
            .filter(
              (o) => !["DELIVERED", "CANCELLED"].includes(text(o, "status")),
            )
            .map((o) => {
              const next = nextDeliveryStatus(text(o, "status"));
              return (
                <article key={text(o, "id")} className="surface space-y-3 p-4">
                  <h3 className="font-bold">
                    #{text(o, "orderNumber")} · {text(o, "customerName")}
                  </h3>
                  <p className="text-sm">
                    {text(o, "customerPhone")}
                    <br />
                    {text(o, "addressLine")}
                  </p>
                  <p className="text-sm">
                    Rider:{" "}
                    <strong>{text(o, "riderName", "Assign nahi hua")}</strong>
                  </p>
                  <p className="text-sm">
                    {text(o, "status").replaceAll("_", " ")} ·{" "}
                    {text(o, "paymentStatus")}
                  </p>
                  <p className="font-semibold">
                    Customer se baqi: {money(o.remainingDue)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {!o.riderId && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedOrder(text(o, "id"));
                          setTask("assign");
                          setTimeout(
                            () =>
                              document
                                .getElementById("delivery-action-form")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                }),
                            0,
                          );
                        }}
                      >
                        Rider assign karein
                      </Button>
                    )}
                    {next &&
                      canBusiness(user, "orders") &&
                      canBusiness(user, "payments") && (
                        <Button
                          size="sm"
                          disabled={
                            Boolean(busyOrder) ||
                            (!o.riderId &&
                              ["OUT_FOR_DELIVERY", "DELIVERED"].includes(next))
                          }
                          onClick={() => void changeStatus(o, next)}
                        >
                          {
                            (
                              {
                                CONFIRMED: "Order confirm",
                                PREPARING: "Tayyar karna shuru",
                                READY: "Khana ready",
                                OUT_FOR_DELIVERY: "Rider rawana",
                                DELIVERED: "Delivery complete",
                              } as Record<string, string>
                            )[next]
                          }
                        </Button>
                      )}
                    <Link
                      className="btn-secondary text-sm"
                      href={
                        "/admin/orders?search=" +
                        encodeURIComponent(text(o, "orderNumber"))
                      }
                    >
                      Order dekhein
                    </Link>
                  </div>
                </article>
              );
            })}
        </div>
        {!orders.some(
          (o) => !["DELIVERED", "CANCELLED"].includes(text(o, "status")),
        ) && (
          <p className="surface p-4 text-sm">
            Koi active delivery nahi. Naya delivery order yahan aayega.
          </p>
        )}
      </section>
      <details className="surface p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-bold">
          Delivery order history / Details
        </summary>
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
      </details>
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

function nextDeliveryStatus(status: string): string | undefined {
  return (
    {
      PENDING: "CONFIRMED",
      CONFIRMED: "PREPARING",
      PREPARING: "READY",
      READY: "OUT_FOR_DELIVERY",
      OUT_FOR_DELIVERY: "DELIVERED",
    } as Record<string, string>
  )[status];
}

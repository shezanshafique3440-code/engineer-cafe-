"use client";
import Link from "next/link";
import { paise, decimal } from "@/lib/business-math";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { canBusiness } from "@/lib/business-access";
import { useSession } from "@/context/session-context";
import { useSettings, useMoney } from "@/context/settings-context";
import { buildReceiptHtml, printSlip } from "@/lib/receipt";
import type { OrderDTO } from "@/server/orders";
import { Form, Notice, options, rows, text, money, type Row } from "./shared";
export function TablesPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const { user } = useSession(),
    settings = useSettings(),
    format = useMoney();
  const [payment, setPayment] = useState<Row | null>(null),
    [closing, setClosing] = useState<Row | null>(null);
  const tables = rows(data, "tables");
  const print = async (table: Row, session: Row) => {
    const orders = rows(session, "orders").filter(
      (o) => o.status !== "CANCELLED",
    ) as unknown as OrderDTO[];
    if (!orders.length) return;
    const win = window.open("", "_blank", "width=420,height=700");
    if (!win) {
      toast.error("Allow popups to print a table bill.");
      return;
    }
    const total = orders.reduce((n, o) => n + o.total, 0);
    const bill: OrderDTO = {
      ...orders[0],
      orderNumber: "T" + text(session, "id").slice(-8).toUpperCase(),
      tableName: text(table, "name"),
      waiterName: text(session, "waiter.party.name"),
      serviceMode: "DINE_IN",
      customerName: "Table " + text(table, "name"),
      customerPhone: "",
      addressLine: null,
      area: null,
      city: null,
      total,
      amountPaid: decimal(orders.reduce((s, o) => s + paise(o.amountPaid), 0n)),
      amountRefunded: decimal(
        orders.reduce((s, o) => s + paise(o.amountRefunded), 0n),
      ),
      remainingDue: decimal(
        BigInt(total) * 100n -
          orders.reduce(
            (s, o) => s + paise(o.amountPaid) - paise(o.amountRefunded),
            0n,
          ),
      ),
      refundDue: "0.00",
      subtotal: orders.reduce((n, o) => n + o.subtotal, 0),
      discount: orders.reduce((n, o) => n + o.discount, 0),
      tax: orders.reduce((n, o) => n + o.tax, 0),
      deliveryFee: 0,
      items: orders.flatMap((o) => o.items),
      cashReceived: null,
      cashChange: null,
      paymentStatus:
        Number(text(session, "paid", "0")) >= total ? "PAID" : "UNPAID",
    };
    await printSlip(
      win,
      await buildReceiptHtml(bill, {
        settings,
        money: format,
        origin: window.location.origin,
        tracking: false,
      }),
    );
  };
  return (
    <div className="space-y-5">
      {!data.integrationActive && (
        <Notice>
          Activate the business system after opening balances and recipes are
          ready before using table orders.
        </Notice>
      )}
      {canBusiness(user, "catalog") && (
        <details className="surface p-4">
          <summary className="cursor-pointer font-bold">
            Add a cafe table
          </summary>
          <div className="mt-3">
            <Form
              title="Table details"
              module="tables"
              fields={[
                { name: "name", label: "Table name / number" },
                {
                  name: "seats",
                  label: "Seats",
                  type: "number",
                  min: "1",
                  max: "100",
                  step: "1",
                  value: "4",
                },
                {
                  name: "isActive",
                  label: "Available for service",
                  type: "checkbox",
                  value: true,
                },
              ]}
              build={(v) => ({ ...v, action: "SAVE", seats: Number(v.seats) })}
              onDone={reload}
            />
          </div>
        </details>
      )}
      <Form
        title="Open a table bill"
        module="tables"
        disabled={!data.integrationActive}
        fields={[
          {
            name: "tableId",
            label: "Available table",
            type: "select",
            options: options(tables.filter((t) => t.isActive && !t.busy)),
          },
          {
            name: "waiterId",
            label: "Assigned waiter",
            type: "select",
            required: false,
            options: rows(data, "waiters").map((w) => ({
              value: text(w, "id"),
              label: text(w, "code") + " · " + text(w, "party.name"),
            })),
          },
          {
            name: "guestCount",
            label: "Guests",
            type: "number",
            step: "1",
            min: "1",
            max: "100",
            value: "1",
          },
        ]}
        build={(v) => ({
          ...v,
          action: "OPEN",
          guestCount: Number(v.guestCount),
          waiterId: v.waiterId || undefined,
        })}
        onDone={reload}
        submitLabel="Open table"
      />
      {payment && (
        <Form
          key={"pay:" + text(payment, "id")}
          title="Receive table payment"
          description="Record cash/bank splits one at a time. Each receipt is allocated to the table’s tickets."
          module="tables"
          fields={[
            {
              name: "amount",
              label: "Amount received (Rs.)",
              type: "number",
              min: "0.01",
            },
            {
              name: "accountId",
              label: "Received into",
              type: "select",
              options: options(rows(data, "accounts")),
            },
            { name: "note", label: "Payment reference" },
          ]}
          build={(v) => ({ ...v, action: "PAY", sessionId: payment.id })}
          onDone={() => {
            setPayment(null);
            reload();
          }}
          submitLabel="Record receipt"
        />
      )}
      {closing && (
        <Form
          title="Close settled table"
          module="tables"
          fields={[]}
          build={() => ({ action: "CLOSE", sessionId: closing.id })}
          onDone={() => {
            setClosing(null);
            reload();
          }}
          submitLabel="Confirm close"
        />
      )}
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => {
          const session = rows(table, "sessions")[0];
          return (
            <article className="surface min-w-0 p-4" key={text(table, "id")}>
              <div className="flex justify-between gap-3">
                <h2 className="text-xl font-bold">{text(table, "name")}</h2>
                <span className="chip bg-cream-100">
                  {table.busy ? "In service" : "Available"}
                </span>
              </div>
              <p className="mt-1 text-xs text-charcoal-500">
                {text(table, "seats")} seats
              </p>
              {table.busy && !session ? (
                <p className="mt-3 text-sm text-charcoal-500">
                  This table is assigned to another waiter.
                </p>
              ) : null}
              {session && (
                <>
                  <p className="mt-3 text-sm">
                    Waiter: {text(session, "waiter.party.name", "Unassigned")} ·{" "}
                    {text(session, "guestCount")} guests
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt>Total</dt>
                      <dd className="font-bold">{money(session.total)}</dd>
                    </div>
                    <div>
                      <dt>Received</dt>
                      <dd className="font-bold">{money(session.paid)}</dd>
                    </div>
                  </dl>
                  <ul className="my-4 space-y-2 text-xs">
                    {rows(session, "orders").map((o) => (
                      <li
                        key={text(o, "id")}
                        className="flex justify-between gap-3 rounded-lg bg-cream-100 p-2"
                      >
                        <span>
                          #{text(o, "orderNumber")} · {text(o, "status")}
                        </span>
                        <span>{money(o.total)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="btn-primary text-xs"
                      href={
                        "/admin/table-orders?session=" + text(session, "id")
                      }
                    >
                      Add items / send ticket
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void print(table, session)}
                    >
                      Print bill
                    </Button>
                    {canBusiness(user, "payments") && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPayment(session)}
                        >
                          Receive payment
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setClosing(session)}
                        >
                          Close table
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

"use client";
import { paise, decimal } from "@/lib/business-math";
import { CounterPOS } from "@/components/admin/counter-pos";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox } from "@/components/ui";
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
    [closing, setClosing] = useState<Row | null>(null),
    [moving, setMoving] = useState<Row | null>(null),
    [tickets, setTickets] = useState<string[]>([]),
    [ordering, setOrdering] = useState<Row | null>(null),
    [openingTable, setOpeningTable] = useState("");
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
      <div id="open-table-form" className="scroll-mt-24" />
      <details
        className="surface p-4"
        open={Boolean(openingTable) || undefined}
      >
        <summary className="min-h-11 cursor-pointer py-2 font-bold">
          Khali table kholein / Open a table
        </summary>
        <Form
          key={"open:" + openingTable}
          title="Open a table bill"
          module="tables"
          disabled={!data.integrationActive}
          fields={[
            {
              name: "tableId",
              label: "Available table",
              type: "select",
              value: openingTable,
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
          onDone={() => {
            setOpeningTable("");
            reload();
          }}
          submitLabel="Open table"
        />
      </details>
      {moving && (
        <Form
          key={text(moving, "id")}
          title="Move / combine table bills"
          description="Split moves whole tickets, including their existing payments and kitchen status. To divide a single ticket, collect separate cash/bank payments. No revenue or stock is posted again."
          module="tables"
          fields={[
            {
              name: "action",
              label: "Bill operation",
              type: "select",
              value: "TRANSFER",
              options: [
                { value: "TRANSFER", label: "Transfer to an empty table" },
                {
                  value: "MERGE",
                  label: "Merge every ticket into another open bill",
                },
                {
                  value: "SPLIT",
                  label: "Move selected tickets to another open bill",
                },
              ],
            },
            {
              name: "tableId",
              label: "Empty destination table",
              type: "select",
              options: options(tables.filter((t) => t.isActive && !t.busy)),
              visible: (v) => v.action === "TRANSFER",
            },
            {
              name: "targetSessionId",
              label: "Destination bill",
              type: "select",
              options: tables.flatMap((t) =>
                rows(t, "sessions")
                  .filter((s) => s.id !== moving.id)
                  .map((s) => ({
                    value: text(s, "id"),
                    label: text(t, "name") + " · " + money(s.total),
                  })),
              ),
              visible: (v) => v.action !== "TRANSFER",
            },
            { name: "note", label: "Reason for moving bill" },
          ]}
          build={(v) => ({ ...v, sessionId: moving.id, orderIds: tickets })}
          onDone={() => {
            setMoving(null);
            setTickets([]);
            reload();
          }}
          submitLabel="Confirm bill operation"
        >
          {(v) =>
            v.action === "SPLIT" && (
              <div className="space-y-3">
                {rows(moving, "orders").map((o) => (
                  <Checkbox
                    key={text(o, "id")}
                    label={
                      "#" + text(o, "orderNumber") + " · " + money(o.total)
                    }
                    checked={tickets.includes(text(o, "id"))}
                    onChange={(e) =>
                      setTickets((ids) =>
                        e.target.checked
                          ? [...ids, text(o, "id")]
                          : ids.filter((id) => id !== o.id),
                      )
                    }
                  />
                ))}
              </div>
            )
          }
        </Form>
      )}
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
      {ordering && (
        <section id="table-order-desk" className="surface scroll-mt-24 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              {text(ordering, "tableName")} · Order lein
            </h2>
            <Button
              variant="secondary"
              onClick={() => {
                setOrdering(null);
                reload();
              }}
            >
              ← Tables aur bill par wapas
            </Button>
          </div>
          <CounterPOS
            key={text(ordering, "id")}
            mode="TABLE"
            sessionId={text(ordering, "id")}
            embedded
            onRecorded={reload}
          />
        </section>
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
              {!table.busy && Boolean(data.integrationActive) && (
                <Button
                  className="mt-3"
                  onClick={() => {
                    setOpeningTable(text(table, "id"));
                    setTimeout(
                      () =>
                        document
                          .getElementById("open-table-form")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          }),
                      0,
                    );
                  }}
                >
                  Yeh table kholein
                </Button>
              )}
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
                  <p className="mt-3 rounded-xl bg-chai-50 p-3 font-bold">
                    Baqi payment:{" "}
                    {money(
                      decimal(
                        paise(text(session, "total", "0")) -
                          paise(text(session, "paid", "0")),
                      ),
                    )}
                  </p>
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
                    {canBusiness(user, "table-orders") && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setOrdering({ ...session, tableName: table.name });
                          setTimeout(
                            () =>
                              document
                                .getElementById("table-order-desk")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                }),
                            0,
                          );
                        }}
                      >
                        Add items / send ticket
                      </Button>
                    )}
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
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setMoving(session);
                            setTickets([]);
                          }}
                        >
                          Transfer / merge / split
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

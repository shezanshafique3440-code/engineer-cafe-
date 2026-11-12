"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui";
import {
  Form,
  Table,
  Cell,
  Notice,
  options,
  rows,
  text,
  money,
  day,
  type Row,
  type Field,
} from "./shared";
import { paise, decimal } from "@/lib/business-math";
import { stockAmount } from "@/lib/stock-units";
import { LineEditor, type IngredientLine } from "./stock-panels";
const note: Field = { name: "note", label: "Reason / reference" };
const moneyAccounts = (data: Row) => options(rows(data, "accounts"));
export function PartiesPanel({
  data,
  reload,
  customers = false,
}: {
  data: Row;
  reload: () => void;
  customers?: boolean;
}) {
  const [editing, setEditing] = useState<Row | null>(null);
  const items = rows(data, "parties");
  return (
    <div className="space-y-5">
      <Form
        key={text(editing ?? undefined, "id", "new")}
        module={customers ? "customers" : "suppliers"}
        title={
          editing
            ? "Edit " + (customers ? "customer" : "supplier")
            : "Add " + (customers ? "credit customer" : "supplier")
        }
        fields={[
          {
            name: "name",
            label: "Name",
            value: text(editing ?? undefined, "name"),
          },
          {
            name: "phone",
            label: "Phone",
            required: false,
            value: text(editing ?? undefined, "phone"),
          },
          {
            name: "email",
            advanced: true,
            label: "Email",
            type: "email",
            required: false,
            value: text(editing ?? undefined, "email"),
          },
          {
            name: "address",
            advanced: true,
            label: "Address",
            required: false,
            value: text(editing ?? undefined, "address"),
          },
          ...(customers
            ? [
                {
                  name: "creditLimit",
                  label: "Approved credit limit (Rs.)",
                  type: "number" as const,
                  min: "0",
                  value: text(editing ?? undefined, "creditLimit", "0"),
                },
              ]
            : []),
          {
            name: "isActive",
            label: "Active",
            type: "checkbox",
            value: editing ? Boolean(editing.isActive) : true,
          },
        ]}
        build={(v) => ({ ...v, id: editing?.id, version: editing?.version })}
        onDone={() => {
          setEditing(null);
          reload();
        }}
      />
      {!customers && (
        <details className="surface p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-bold">
            Record supplier payment or refund
          </summary>
          <Form
            title="Supplier payment / refund"
            module="payments"
            review={(v) => (
              <div className="space-y-2 text-sm">
                <p>
                  {v.kind === "SUPPLIER_REFUND"
                    ? "Receive supplier refund"
                    : "Pay supplier"}
                  : <strong>{money(v.amount)}</strong>
                </p>
                <p>
                  Supplier:{" "}
                  {text(
                    items.find((p) => p.id === v.partyId),
                    "name",
                  )}
                </p>
                <p>
                  Account:{" "}
                  {text(
                    rows(data, "accounts").find((a) => a.id === v.accountId),
                    "name",
                  )}
                </p>
                <p>
                  Confirm the money actually handed over. This changes the
                  supplier balance, not ingredient stock.
                </p>
              </div>
            )}
            fields={[
              {
                name: "kind",
                label: "Transaction",
                type: "select",
                value: "SUPPLIER_PAYMENT",
                options: [
                  {
                    value: "SUPPLIER_PAYMENT",
                    label: "Pay supplier / supplier advance",
                  },
                  {
                    value: "SUPPLIER_REFUND",
                    label: "Receive supplier refund",
                  },
                ],
              },
              {
                name: "partyId",
                label: "Supplier",
                type: "select",
                options: options(items),
              },
              {
                name: "amount",
                label: "Amount (Rs.)",
                type: "number",
                min: "0.01",
              },
              {
                name: "accountId",
                label: "Money account",
                type: "select",
                options: moneyAccounts(data),
              },
              {
                name: "date",
                label: "Payment date",
                type: "date",
                value: text(data, "today"),
              },
              note,
            ]}
            build={(v) => ({ ...v })}
            onDone={reload}
            submitLabel="Record supplier payment"
          />
        </details>
      )}
      <Table
        headers={[
          "Name",
          "Contact",
          customers ? "Customer owes / credit" : "Amount due / supplier credit",
          ...(customers ? ["Credit limit"] : []),
          "Actions",
        ]}
        empty={!items.length}
      >
        {items.map((p) => (
          <tr key={text(p, "id")}>
            <Cell>
              <strong>{text(p, "name")}</strong>
              {!p.isActive && <span className="block text-xs">Inactive</span>}
            </Cell>
            <Cell>
              {text(p, "phone")}
              <span className="block text-xs">{text(p, "email")}</span>
            </Cell>
            <Cell>
              {money(p.balance)}
              <span className="block text-xs text-charcoal-500">
                {Number(p.balance) < 0
                  ? customers
                    ? "Customer credit available"
                    : "Supplier advance / credit available"
                  : "Amount still owed"}
                .
              </span>
            </Cell>
            {customers && <Cell>{money(p.creditLimit)}</Cell>}
            <Cell>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(p)}
              >
                Edit
              </Button>
            </Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}
export function PurchasesPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const [lines, setLines] = useState<IngredientLine[]>([
      { ingredientId: "", quantity: "", totalCost: "" },
    ]),
    [returning, setReturning] = useState<Row | null>(null);
  const accountOptions = moneyAccounts(data);
  return (
    <div className="space-y-5">
      <Notice>
        Example: receive 2 litres of milk costing Rs. 600. Enter 2 L and a line
        total of 600. If you pay 400 now, the supplier is owed 200. Stock is
        received once; later payments are recorded separately.
      </Notice>
      <div className="flex flex-wrap gap-3">
        <Link
          className="btn-secondary"
          href="/admin/business?section=suppliers"
        >
          Supplier setup / payment
        </Link>
        <Link
          className="btn-secondary"
          href="/admin/business?section=inventory"
        >
          Ingredients / stock
        </Link>
      </div>
      {(!rows(data, "suppliers").length ||
        !rows(data, "ingredients").length) && (
        <Notice>
          Add a supplier and at least one ingredient using the links above
          before receiving a purchase.
        </Notice>
      )}
      <Form
        module="purchases"
        title="Receive supplier invoice"
        description="1. Choose the supplier. 2. Add what arrived. 3. Enter what you actually paid and review."
        disabled={
          !rows(data, "suppliers").length || !rows(data, "ingredients").length
        }
        successMessage="Purchase saved. Stock received and supplier balance updated."
        footer={(v) => (
          <InvoiceTotals lines={lines} paid={String(v.paid || "0")} />
        )}
        review={(v) => {
          if (
            !lines.length ||
            lines.some(
              (l) => !l.ingredientId || !l.quantity || l.totalCost === "",
            )
          )
            throw Error(
              "Choose an ingredient, quantity and total cost for each invoice line.",
            );
          const total = lines.reduce((sum, l) => sum + paise(l.totalCost), 0n),
            paid = paise(String(v.paid || "0"));
          if (paid > total)
            throw Error(
              "Paid now is more than the invoice total. Record an advance separately in Supplier balances.",
            );
          if (paid > 0n && !v.accountId)
            throw Error("Choose the account used to pay this supplier.");
          return (
            <div className="space-y-2 text-sm">
              <p>
                <strong>
                  {text(
                    rows(data, "suppliers").find((p) => p.id === v.supplierId),
                    "name",
                  )}
                </strong>{" "}
                · invoice {String(v.invoiceNumber)}
              </p>
              {lines.map((l, i) => (
                <p key={i}>
                  {text(
                    rows(data, "ingredients").find(
                      (r) => r.id === l.ingredientId,
                    ),
                    "name",
                  )}{" "}
                  ·{" "}
                  {stockAmount(
                    l.quantity,
                    text(
                      rows(data, "ingredients").find(
                        (r) => r.id === l.ingredientId,
                      ),
                      "unit",
                    ),
                  )}{" "}
                  · {money(l.totalCost)}
                </p>
              ))}
              <p>
                Invoice total: <strong>{money(decimal(total))}</strong>
              </p>
              <p>
                Paid now: {money(decimal(paid))} · Still owed:{" "}
                <strong>{money(decimal(total - paid))}</strong>
              </p>
              <p>
                Confirming receives this stock and records this payment once.
              </p>
            </div>
          );
        }}
        submitLabel="Post invoice & receive stock"
        fields={[
          {
            name: "supplierId",
            label: "Supplier",
            type: "select",
            options: options(rows(data, "suppliers")),
          },
          {
            name: "invoiceNumber",
            label: "Supplier invoice number",
            placeholder: "e.g. INV-104 or the supplier receipt number",
          },
          {
            name: "date",
            advanced: true,
            label: "Invoice / accounting date",
            type: "date",
            value: text(data, "today"),
          },
          {
            name: "paid",
            afterContent: true,
            label: "Paid now (Rs.)",
            hint: "Enter 0 if nothing was paid. Pay the balance later from Supplier balances.",
            type: "number",
            min: "0",
            value: "0",
          },
          {
            name: "accountId",
            afterContent: true,
            label: "Paid from",
            visible: (v) => Number(v.paid) > 0,
            type: "select",
            options: accountOptions,
            required: false,
          },
          {
            name: "note",
            label: "Reference / notes",
            required: false,
            advanced: true,
          },
        ]}
        build={(v) => ({
          ...v,
          action: "POST",
          lines: lines.map((l) => ({ ...l })),
          accountId: v.accountId || undefined,
        })}
        onDone={() => {
          setLines([{ ingredientId: "", quantity: "", totalCost: "" }]);
          reload();
        }}
      >
        {() => (
          <>
            <LineEditor
              ingredients={rows(data, "ingredients")}
              lines={lines}
              setLines={setLines}
              cost
            />
          </>
        )}
      </Form>
      {returning && (
        <Form
          key={text(returning, "id")}
          module="purchases"
          title={"Return " + text(returning, "ingredient.name")}
          fields={[
            {
              name: "quantity",
              label: "Quantity returned (stock unit)",
              type: "number",
              min: "0.0001",
              step: "0.0001",
            },
            {
              name: "date",
              label: "Return date",
              type: "date",
              value: text(data, "today"),
            },
            note,
          ]}
          build={(v) => ({ ...v, action: "RETURN", lineId: returning.id })}
          onDone={() => {
            setReturning(null);
            reload();
          }}
          submitLabel="Record supplier return"
        />
      )}
      <div className="space-y-4">
        {rows(data, "purchases").map((p) => (
          <article className="surface p-4" key={text(p, "id")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">
                  {text(p, "supplier.name")} · {text(p, "invoiceNumber")}
                </h3>
                <p className="text-xs text-charcoal-500">{day(p.date)}</p>
              </div>
              <strong>{money(p.total)}</strong>
            </div>
            <Table
              headers={[
                "Ingredient",
                "Received",
                "Cost",
                "Returned",
                "Actions",
              ]}
              empty={!rows(p, "lines").length}
            >
              {rows(p, "lines").map((l) => (
                <tr key={text(l, "id")}>
                  <Cell>{text(l, "ingredient.name")}</Cell>
                  <Cell>
                    {text(l, "quantity")} {text(l, "ingredient.unit")}
                  </Cell>
                  <Cell>{money(l.totalCost)}</Cell>
                  <Cell>{text(l, "returnedQuantity")}</Cell>
                  <Cell>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setReturning(l)}
                    >
                      Return stock
                    </Button>
                  </Cell>
                </tr>
              ))}
            </Table>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold">
                Pay this invoice / record an advance
              </summary>
              <div className="mt-3">
                <Form
                  title="Supplier payment"
                  module="payments"
                  fields={[
                    {
                      name: "amount",
                      label: "Amount paid (Rs.)",
                      type: "number",
                      min: "0.01",
                    },
                    {
                      name: "accountId",
                      label: "Paid from",
                      type: "select",
                      options: accountOptions,
                    },
                    {
                      name: "date",
                      label: "Payment date",
                      type: "date",
                      value: text(data, "today"),
                    },
                    note,
                  ]}
                  build={(v) => ({
                    ...v,
                    kind: "SUPPLIER_PAYMENT",
                    partyId: p.supplierId,
                    purchaseId: p.id,
                  })}
                  onDone={reload}
                  submitLabel="Record payment"
                />
              </div>
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}
export function ExpensesPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  return (
    <div className="space-y-5">
      <Notice>
        For gas, rent, electricity or a repair: choose Business expense, enter
        the amount actually paid and the account it came from, then give a short
        reason. Salary payments belong in Payroll; supplier payments belong in
        Purchases.
      </Notice>
      <Form
        title="Record expense / money movement"
        module="money"
        review={(v) => (
          <div className="space-y-2 text-sm">
            <p>
              <strong>{String(v.kind).replaceAll("_", " ")}</strong> ·{" "}
              {money(v.amount)}
            </p>
            <p>
              Account:{" "}
              {text(
                rows(data, "accounts").find((a) => a.id === v.accountId),
                "name",
              )}
            </p>
            {v.kind === "TRANSFER" && (
              <p>
                To:{" "}
                {text(
                  rows(data, "accounts").find((a) => a.id === v.toAccountId),
                  "name",
                )}
              </p>
            )}
            <p>
              {String(v.date)} · {String(v.note)}
            </p>
            <p>
              Confirm only money that actually moved. This creates the
              accounting entry.
            </p>
          </div>
        )}
        fields={[
          {
            name: "kind",
            label: "Transaction",
            type: "select",
            value: "EXPENSE",
            options: [
              { value: "EXPENSE", label: "Business expense" },
              ...(data.owner
                ? [
                    { value: "CAPITAL", label: "Owner investment" },
                    { value: "DRAW", label: "Owner withdrawal" },
                    {
                      value: "TRANSFER",
                      label: "Transfer between money accounts",
                    },
                    { value: "CORRECTION", label: "Cash shortage correction" },
                    {
                      value: "CORRECTION_IN",
                      label: "Cash overage correction",
                    },
                    ...(!data.integrationActive
                      ? [
                          {
                            value: "OPENING",
                            label: "Opening cash / bank balance",
                          },
                        ]
                      : []),
                  ]
                : []),
            ],
          },
          {
            name: "amount",
            label: "Amount (Rs.)",
            type: "number",
            min: "0.01",
          },
          {
            name: "accountId",
            label: "Money account",
            type: "select",
            options: moneyAccounts(data),
          },
          {
            name: "toAccountId",
            label: "Destination account",
            type: "select",
            options: moneyAccounts(data),
            visible: (v) => v.kind === "TRANSFER",
          },
          {
            name: "expenseCode",
            label: "Expense category",
            type: "select",
            value: "OTHER_EXPENSE",
            options: [
              ["RENT", "Rent"],
              ["GAS", "Gas"],
              ["ELECTRICITY", "Electricity"],
              ["PACKAGING", "Packaging"],
              ["DELIVERY_EXPENSE", "Delivery"],
              ["REPAIRS", "Repairs / maintenance"],
              ["OTHER_EXPENSE", "Other expense"],
            ].map(([value, label]) => ({ value, label })),
            visible: (v) => v.kind === "EXPENSE",
          },
          {
            name: "date",
            label: "Accounting date",
            type: "date",
            value: text(data, "today"),
          },
          note,
        ]}
        build={(v) => ({
          ...v,
          toAccountId: v.toAccountId || undefined,
          expenseCode: v.kind === "EXPENSE" ? v.expenseCode : undefined,
        })}
        onDone={reload}
        submitLabel="Post transaction"
      />
      <details className="surface p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-bold">
          Previous transactions & corrections
        </summary>
        <JournalList data={data} reload={reload} />
      </details>
    </div>
  );
}
export function JournalList({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  return (
    <div className="space-y-4">
      {selected && (
        <Form
          key={text(selected, "id")}
          title="Reverse posted transaction"
          description="This adds an opposite entry and retains the original. Use order refunds, stock returns and payroll reversal for those modules."
          module="reversal"
          fields={[note]}
          build={(v) => ({ ...v, id: selected.id })}
          onDone={() => {
            setSelected(null);
            reload();
          }}
          submitLabel="Post reversal"
        />
      )}
      {rows(data, "journals").map((j) => (
        <article key={text(j, "id")} className="surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bold">
                {text(j, "source")} · {day(j.date)}
              </p>
              <p className="mt-1 text-sm">{text(j, "note")}</p>
              <p className="mt-1 text-xs text-charcoal-500">
                Recorded by {text(j, "actorName")}
                {j.reversedBy ? " · Reversed" : ""}
              </p>
            </div>
            {Boolean(data.owner) &&
              !j.reversedBy &&
              [
                "EXPENSE",
                "CAPITAL",
                "DRAW",
                "TRANSFER",
                "CORRECTION",
                "CORRECTION_IN",
                "OPENING",
                "SUPPLIER_PAYMENT",
                "SUPPLIER_REFUND",
                "STAFF_ADVANCE",
                "STAFF_REPAYMENT",
                "PAYROLL_PAYMENT",
                "SALARY_BALANCE_PAYMENT",
                "CUSTOMER_RECEIPT",
              ].includes(text(j, "source")) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelected(j)}
                >
                  Correct / reverse
                </Button>
              )}
          </div>
          <div className="mt-3">
            <Table
              headers={["Account", "Party", "Debit", "Credit"]}
              empty={!rows(j, "postings").length}
            >
              {rows(j, "postings").map((p) => (
                <tr key={text(p, "id")}>
                  <Cell>{text(p, "account.name")}</Cell>
                  <Cell>{text(p, "party.name", "—")}</Cell>
                  <Cell>{money(p.debit)}</Cell>
                  <Cell>{money(p.credit)}</Cell>
                </tr>
              ))}
            </Table>
          </div>
        </article>
      ))}
    </div>
  );
}

function InvoiceTotals({
  lines,
  paid,
}: {
  lines: IngredientLine[];
  paid: string;
}) {
  try {
    const total = lines.reduce((sum, l) => sum + paise(l.totalCost || "0"), 0n),
      payment = paise(paid || "0");
    return (
      <section
        aria-label="Invoice totals"
        className="rounded-xl border border-chai-200 bg-chai-50 p-4"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <p>
            Invoice total
            <strong className="block text-lg">{money(decimal(total))}</strong>
          </p>
          <p>
            Paid now
            <strong className="block text-lg">{money(decimal(payment))}</strong>
          </p>
          <p>
            Still owed
            <strong className="block text-lg">
              {money(decimal(total - payment))}
            </strong>
          </p>
        </div>
        {payment > total && (
          <p role="alert" className="mt-2 text-sm text-chilli-600">
            Paid now exceeds the invoice. Check the amount before continuing.
          </p>
        )}
      </section>
    );
  } catch {
    return (
      <p role="status" className="text-sm">
        Enter valid line totals and payment to calculate the balance.
      </p>
    );
  }
}

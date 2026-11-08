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
            label: "Email",
            type: "email",
            required: false,
            value: text(editing ?? undefined, "email"),
          },
          {
            name: "address",
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
        <Form
          title="Supplier payment / refund"
          module="payments"
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
                { value: "SUPPLIER_REFUND", label: "Receive supplier refund" },
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
                Negative means{" "}
                {customers ? "customer credit" : "supplier advance / credit"}.
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
        Receiving a purchase increases ingredient stock and records the supplier
        bill. A payment reduces cash/bank and supplier dues; purchases become
        food cost when ingredients are used. Enter quantities in each
        ingredient’s stock unit.
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
      <Form
        module="purchases"
        title="Receive supplier invoice"
        submitLabel="Post invoice & receive stock"
        fields={[
          {
            name: "supplierId",
            label: "Supplier",
            type: "select",
            options: options(rows(data, "suppliers")),
          },
          { name: "invoiceNumber", label: "Supplier invoice number" },
          {
            name: "date",
            label: "Invoice / accounting date",
            type: "date",
            value: text(data, "today"),
          },
          {
            name: "paid",
            label: "Paid now (Rs.)",
            type: "number",
            min: "0",
            value: "0",
          },
          {
            name: "accountId",
            label: "Paid from",
            type: "select",
            options: accountOptions,
            required: false,
          },
          { name: "note", label: "Reference / notes", required: false },
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
          <LineEditor
            ingredients={rows(data, "ingredients")}
            lines={lines}
            setLines={setLines}
            cost
          />
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
        Salary accruals and ingredient usage are posted by payroll and orders.
        Record other expenses here once. Owner investment, withdrawals and money
        transfers do not count as operating profit.
      </Notice>
      <Form
        title="Record expense / money movement"
        module="money"
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
      <JournalList data={data} reload={reload} />
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

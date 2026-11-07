"use client";
import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { apiGet } from "@/lib/api-client";
import { paise, quantity, decimal } from "@/lib/business-math";
import { downloadCsv } from "@/lib/csv";
import {
  Form,
  Table,
  Cell,
  Notice,
  Stat,
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
export function ProcurementPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const [lines, setLines] = useState<IngredientLine[]>([
    { ingredientId: "", quantity: "", totalCost: "" },
  ]);
  const [selected, setSelected] = useState<Row | null>(null),
    [action, setAction] = useState("APPROVE");
  return (
    <div className="space-y-5">
      <Notice>
        Draft → approval → receive supplier invoice. A purchase order reserves
        no stock or cash. Receiving posts the agreed quantities and costs once.
        For short or changed deliveries, cancel the commitment and enter the
        actual supplier invoice in Purchases.
      </Notice>
      <Form
        title="Create purchase order"
        module="procurement"
        fields={[
          {
            name: "supplierId",
            label: "Supplier",
            type: "select",
            options: options(rows(data, "suppliers")),
          },
          {
            name: "expectedOn",
            label: "Expected delivery",
            type: "date",
            value: text(data, "today"),
          },
          note,
        ]}
        build={(v) => ({ ...v, action: "DRAFT", lines })}
        onDone={reload}
        submitLabel="Save purchase order"
      >
        {() => (
          <LineEditor
            lines={lines}
            setLines={setLines}
            ingredients={rows(data, "ingredients")}
            cost
          />
        )}
      </Form>
      {selected && (
        <Form
          key={action + text(selected, "id")}
          title={action + " · " + text(selected, "reference")}
          module="procurement"
          description={
            "Agreed total " +
            money(selected.total) +
            ". Receiving adds stock and the supplier bill."
          }
          fields={
            action === "RECEIVE"
              ? [
                  { name: "invoiceNumber", label: "Supplier invoice number" },
                  {
                    name: "date",
                    label: "Receipt / invoice date",
                    type: "date",
                    value: text(data, "today"),
                    max: text(data, "today"),
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
                    label: "Paid from (when paying)",
                    type: "select",
                    required: false,
                    options: options(rows(data, "accounts")),
                  },
                  note,
                ]
              : [note]
          }
          build={(v) => ({
            ...v,
            action,
            id: selected.id,
            version: selected.updatedAt,
            accountId: v.accountId || undefined,
          })}
          onDone={() => {
            setSelected(null);
            reload();
          }}
          submitLabel={
            action === "RECEIVE"
              ? "Receive agreed stock & post invoice"
              : "Confirm " + action.toLowerCase()
          }
        />
      )}
      <h2 className="text-xl font-bold">Latest 100 purchase orders</h2>
      {rows(data, "orders").map((po) => (
        <article key={text(po, "id")} className="surface space-y-3 p-4">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h3 className="font-bold">
                {text(po, "reference")} · {text(po, "supplierName")}
              </h3>
              <p className="text-sm">
                {text(po, "status")} · Expected {day(po.expectedOn)} ·{" "}
                {money(po.total)}
              </p>
              <p className="text-xs">
                Created by {text(po, "createdByName")}
                {po.approvedByName
                  ? " · Approved by " + text(po, "approvedByName")
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {po.status === "DRAFT" && Boolean(data.canReview) && (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelected(po);
                    setAction("APPROVE");
                  }}
                >
                  Approve
                </Button>
              )}
              {po.status === "APPROVED" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelected(po);
                    setAction("RECEIVE");
                  }}
                >
                  Receive delivery
                </Button>
              )}
              {["DRAFT", "APPROVED"].includes(text(po, "status")) &&
                Boolean(data.canReview) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelected(po);
                      setAction("CANCEL");
                    }}
                  >
                    Cancel order
                  </Button>
                )}
            </div>
          </div>
          <Table headers={["Ingredient", "Quantity", "Agreed cost"]}>
            {rows(po, "lines").map((l) => (
              <tr key={text(l, "ingredientId")}>
                <Cell>{text(l, "name")}</Cell>
                <Cell>
                  {text(l, "quantity")} {text(l, "unit")}
                </Cell>
                <Cell>{money(l.totalCost)}</Cell>
              </tr>
            ))}
          </Table>
          <p className="text-sm">
            {text(po, "note")}
            {po.purchaseId ? " · Linked invoice recorded" : ""}
          </p>
        </article>
      ))}
    </div>
  );
}
export function StockCountsPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const [values, setValues] = useState<
    Record<string, { counted: string; addedValue: string }>
  >({});
  const [selected, setSelected] = useState<Row | null>(null),
    [action, setAction] = useState("POST");
  const ingredients = rows(data, "ingredients");
  return (
    <div className="space-y-5">
      <Notice>
        Enter only ingredients physically counted. Blank means skip; zero means
        none on hand. Drafting does not change stock. Review and post together;
        if stock moved after the snapshot, discard the draft and recount. Stop
        kitchen movements while counting.
      </Notice>
      <Button
        variant="secondary"
        onClick={() =>
          downloadCsv(
            "stock-count-sheet.csv",
            ["Ingredient", "Unit", "Recorded quantity", "Physical quantity"],
            ingredients.map((i) => [
              text(i, "name"),
              text(i, "unit"),
              text(i, "quantity"),
              "",
            ]),
          )
        }
      >
        Export count sheet
      </Button>
      <Form
        title="Physical stock count"
        module="stockcounts"
        fields={[
          {
            name: "date",
            label: "Count date",
            type: "date",
            value: text(data, "today"),
            max: text(data, "today"),
          },
          note,
        ]}
        build={(v) => ({
          ...v,
          action: "DRAFT",
          lines: ingredients
            .filter(
              (i) =>
                values[text(i, "id")]?.counted !== undefined &&
                values[text(i, "id")].counted !== "",
            )
            .map((i) => ({
              ingredientId: i.id,
              version: i.version,
              counted: values[text(i, "id")].counted,
              addedValue: values[text(i, "id")].addedValue || undefined,
            })),
        })}
        onDone={() => {
          setValues({});
          reload();
        }}
        submitLabel="Save count for review"
      >
        {() => (
          <div className="grid gap-3 lg:grid-cols-2">
            {ingredients.map((i) => (
              <div
                className="rounded-xl border border-cream-200 p-3"
                key={text(i, "id")}
              >
                <p className="mb-3 font-semibold">
                  {text(i, "name")} · {text(i, "quantity")} {text(i, "unit")}{" "}
                  recorded
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label={"Counted " + text(i, "name")}
                    type="number"
                    min="0"
                    step="0.0001"
                    value={values[text(i, "id")]?.counted ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [text(i, "id")]: {
                          addedValue: v[text(i, "id")]?.addedValue ?? "",
                          counted: e.target.value,
                        },
                      }))
                    }
                  />
                  <Input
                    label={"Extra stock cost · " + text(i, "name")}
                    hint="Total value of extra quantity only; required for an increase."
                    type="number"
                    min="0"
                    step="0.01"
                    value={values[text(i, "id")]?.addedValue ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [text(i, "id")]: {
                          counted: v[text(i, "id")]?.counted ?? "",
                          addedValue: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Form>
      {selected && (
        <Form
          key={action + text(selected, "id")}
          title={action + " " + text(selected, "reference")}
          module="stockcounts"
          fields={[note]}
          build={(v) => ({
            ...v,
            action,
            id: selected.id,
            version: selected.updatedAt,
          })}
          onDone={() => {
            setSelected(null);
            reload();
          }}
          submitLabel={
            action === "POST" ? "Post all count differences" : "Discard draft"
          }
        />
      )}
      <h2 className="text-xl font-bold">Latest 100 stock counts</h2>
      {rows(data, "counts").map((c) => (
        <article className="surface space-y-3 p-4" key={text(c, "id")}>
          <h3 className="font-bold">
            {text(c, "reference")} · {text(c, "status")} · {day(c.date)}
          </h3>
          <p className="text-xs">
            Counted by {text(c, "createdByName")} · {text(c, "note")}
          </p>
          <Table headers={["Ingredient", "Recorded", "Counted", "Difference"]}>
            {rows(c, "lines").map((l) => (
              <tr key={text(l, "ingredientId")}>
                <Cell>
                  {text(l, "name")} ({text(l, "unit")})
                </Cell>
                <Cell>{text(l, "expected")}</Cell>
                <Cell>{text(l, "counted")}</Cell>
                <Cell>
                  {decimal(
                    quantity(text(l, "counted")) -
                      quantity(text(l, "expected")),
                    4,
                  )}
                </Cell>
              </tr>
            ))}
          </Table>
          {c.status === "DRAFT" && (
            <div className="flex gap-2">
              {Boolean(data.canReview) && (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelected(c);
                    setAction("POST");
                  }}
                >
                  Review & post
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSelected(c);
                  setAction("CANCEL");
                }}
              >
                Discard draft
              </Button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
export function ApprovalsPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  return (
    <div className="space-y-5">
      <Notice>
        Cashier refund requests start from the cancelled order. Discount
        requests start from the exact counter cart. Manager/owner reviews expire
        after 24 hours and can be used once by the requesting cashier. Approval
        alone moves no money.
      </Notice>
      {selected && (
        <Form
          key={text(selected, "id")}
          title={
            "Review " +
            text(selected, "kind").toLowerCase() +
            " · " +
            money(selected.amount)
          }
          description={text(selected, "reason")}
          module="approvals"
          fields={[
            {
              name: "approved",
              label: "Approve this request",
              type: "checkbox",
              value: true,
            },
            note,
          ]}
          build={(v) => ({ ...v, action: "DECIDE", id: selected.id })}
          onDone={() => {
            setSelected(null);
            reload();
          }}
          submitLabel="Record decision"
        />
      )}
      <Table
        headers={[
          "Request",
          "Requested by",
          "Amount",
          "Reason",
          "Decision",
          "Actions",
        ]}
        empty={!rows(data, "approvals").length}
      >
        {rows(data, "approvals").map((a) => (
          <tr key={text(a, "id")}>
            <Cell>
              {text(a, "kind")} {text(a, "orderNumber")}
              <p className="text-xs">
                Expires{" "}
                {new Date(text(a, "expiresAt")).toLocaleString("en-PK", {
                  timeZone: "Asia/Karachi",
                })}
              </p>
            </Cell>
            <Cell>{text(a, "requestedByName")}</Cell>
            <Cell>{money(a.amount)}</Cell>
            <Cell>
              {text(a, "reason")}
              {rows(a, "context.items").map((i, n) => (
                <p className="text-xs" key={n}>
                  {text(i, "quantity")} × {text(i, "name")} ·{" "}
                  {money(i.lineTotal)}
                </p>
              ))}
            </Cell>
            <Cell>
              {new Date(text(a, "expiresAt")) < new Date() &&
              ["PENDING", "APPROVED"].includes(text(a, "status"))
                ? "EXPIRED"
                : text(a, "status")}
              <p className="text-xs">
                {text(a, "reviewedByName")} · {text(a, "reviewNote")}
              </p>
            </Cell>
            <Cell>
              {Boolean(data.canReview) &&
                a.status === "PENDING" &&
                new Date(text(a, "expiresAt")) > new Date() && (
                  <Button size="sm" onClick={() => setSelected(a)}>
                    Review
                  </Button>
                )}
            </Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}
export function AuditPanel({ data }: { data: Row }) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [result, setResult] = useState(data),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      void apiGet<Row>(
        "/api/admin/business/audit?" +
          new URLSearchParams({
            from: text(data, "from"),
            to: text(data, "to"),
            q,
            page: String(page),
          }),
      )
        .then((r) => {
          if (live) {
            setResult(r);
            setError("");
          }
        })
        .catch((e) => {
          if (live)
            setError(e instanceof Error ? e.message : "History failed to load");
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, page, data]);
  return (
    <div className="space-y-4">
      <Input
        label="Search change history"
        placeholder="Staff name, action, record type or ID"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="self-center text-sm">
          Page {page} · {text(result, "total")} matching changes
        </span>
        <Button
          variant="secondary"
          disabled={page * 50 >= Number(result.total)}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv(
              "change-history-page.csv",
              ["When", "Who", "Action", "Record", "ID", "Details"],
              rows(result, "rows").map((a) => [
                text(a, "createdAt"),
                text(a, "actorName"),
                text(a, "action"),
                text(a, "entity"),
                text(a, "entityId"),
                JSON.stringify(a.details),
              ]),
            )
          }
        >
          Export page
        </Button>
      </div>
      <Table
        headers={["When", "Who", "Action", "Record", "Details"]}
        empty={!rows(result, "rows").length}
      >
        {rows(result, "rows").map((a) => (
          <tr key={text(a, "id")}>
            <Cell>
              {new Date(text(a, "createdAt")).toLocaleString("en-PK", {
                timeZone: "Asia/Karachi",
              })}
            </Cell>
            <Cell>{text(a, "actorName")}</Cell>
            <Cell>{text(a, "action")}</Cell>
            <Cell>
              {text(a, "entity")}
              <p className="max-w-40 break-all text-xs">
                {text(a, "entityId")}
              </p>
            </Cell>
            <Cell>
              <details>
                <summary className="cursor-pointer">View change</summary>
                <pre className="mt-2 max-w-xs whitespace-pre-wrap break-words text-xs">
                  {JSON.stringify(a.details, null, 2)}
                </pre>
              </details>
            </Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}
export function CashFlowPanel({ data }: { data: Row }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Cash flow & daily trading</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Opening money" value={data.openingMoney} />
        <Stat label="Net money movement" value={data.netCashFlow} />
        <Stat label="Closing money" value={data.closingMoney} />
      </div>
      <Notice>
        Money includes all recorded cash, bank, wallet and rider accounts.
        Transfers show both sides and net to zero. Collections, investments and
        loans are not sales. Cash movement differs from profit when bills are
        unpaid or inventory is purchased.
      </Notice>
      <Table
        headers={["Source", "Money in", "Money out", "Net movement"]}
        empty={!rows(data, "cashFlow").length}
      >
        {rows(data, "cashFlow").map((r) => (
          <tr key={text(r, "source")}>
            <Cell>{text(r, "source")}</Cell>
            <Cell>{money(r.received)}</Cell>
            <Cell>{money(r.paid)}</Cell>
            <Cell>
              {money(
                decimal(paise(text(r, "received")) - paise(text(r, "paid"))),
              )}
            </Cell>
          </tr>
        ))}
      </Table>
      <Button
        variant="secondary"
        onClick={() =>
          downloadCsv(
            "daily-trading.csv",
            [
              "Date",
              "Net quantity",
              "Net revenue",
              "Food cost",
              "Gross profit",
            ],
            rows(data, "dailySales").map((r) => [
              day(r.date),
              text(r, "quantity"),
              text(r, "sales"),
              text(r, "cost"),
              text(r, "profit"),
            ]),
          )
        }
      >
        Export daily trading
      </Button>
      <Table
        headers={[
          "Trading date",
          "Net qty",
          "Revenue",
          "Food cost",
          "Gross profit",
        ]}
        empty={!rows(data, "dailySales").length}
      >
        {rows(data, "dailySales").map((r) => (
          <tr key={day(r.date)}>
            <Cell>{day(r.date)}</Cell>
            <Cell>{text(r, "quantity")}</Cell>
            <Cell>{money(r.sales)}</Cell>
            <Cell>{money(r.cost)}</Cell>
            <Cell>{money(r.profit)}</Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}

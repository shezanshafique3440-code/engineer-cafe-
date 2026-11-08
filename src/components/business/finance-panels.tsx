"use client";
import Link from "next/link";
import {
  BUSINESS_CAPABILITIES,
  profileCapabilities,
} from "@/lib/business-access";
import { paise, decimal } from "@/lib/business-math";
import { ClosingChecklist } from "@/components/admin/closing-checklist";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
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
  object,
  type Row,
  type Field,
} from "./shared";
import { JournalList } from "./purchase-panels";
import { CashFlowPanel } from "./operations-panels";
import { printBusinessSlip } from "@/lib/business-slip";
import { toast } from "sonner";
const note: Field = { name: "note", label: "Reason / reference" };
export function OverviewPanel({ data }: { data: Row }) {
  const sales = rows(data, "sales");
  return (
    <div className="space-y-5">
      {!data.integrationActive && (
        <Notice>
          Automatic order accounting is in setup mode. Enter opening stock and
          balances, configure recipes, then activate it in{" "}
          <Link
            className="font-bold underline"
            href="/admin/business?section=setup"
          >
            Opening setup & access
          </Link>
          . Existing website orders remain in their original records.
        </Notice>
      )}
      {Number(data.legacyOrders) > 0 && (
        <Notice>
          {text(data, "legacyOrders")} legacy orders are outside this accounting
          ledger. Opening balances bring their unsettled amounts forward;
          historical recipe costs are never invented.
        </Notice>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Net revenue"
          value={data.revenue}
          detail="Sales less refunds; excludes tax collected."
        />
        <Stat label="Food cost sold" value={data.cogs} />
        <Stat
          label="Gross profit"
          value={data.grossProfit}
          detail="Revenue less cost of food sold."
        />
        <Stat
          label="Net profit"
          value={data.netProfit}
          detail={
            "After operating expenses, wages and recorded wastage. Margin " +
            text(data, "margin", "—") +
            "%."
          }
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Item-wise sales & gross profit</h2>
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv(
              "cafe-item-profit-" + text(data, "from") + ".csv",
              [
                "Item",
                "Quantity sold",
                "Net sales",
                "Food cost",
                "Gross profit",
                "Margin %",
                "Markup %",
              ],
              sales.map((s) => [
                text(s, "productName"),
                text(s, "quantity"),
                text(s, "sales"),
                text(s, "cost"),
                text(s, "profit"),
                text(s, "margin"),
                text(s, "markup"),
              ]),
            )
          }
        >
          Export report
        </Button>
      </div>
      <Table
        headers={[
          "Menu item",
          "Qty sold",
          "Net sale",
          "Food cost",
          "Gross profit",
          "Margin %",
          "Markup %",
        ]}
        empty={!sales.length}
      >
        {sales.map((s, i) => (
          <tr key={text(s, "productName") + i}>
            <Cell>{text(s, "productName")}</Cell>
            <Cell>{text(s, "quantity")}</Cell>
            <Cell>{money(s.sales)}</Cell>
            <Cell>{money(s.cost)}</Cell>
            <Cell>
              <strong>{money(s.profit)}</strong>
            </Cell>
            <Cell>{text(s, "margin", "—")}</Cell>
            <Cell>{text(s, "markup", "—")}</Cell>
          </tr>
        ))}
      </Table>
      <CashFlowPanel data={data} />
      <Notice>
        Margin = profit ÷ sale; markup = profit ÷ cost. Item profit is before
        general cafe expenses. The net-profit card includes those expenses.
        Purchases, owner investment and loan/advance repayments are not counted
        as operating sales.
      </Notice>
      <div className="surface p-4">
        <h2 className="text-lg font-bold">Operating expense breakdown</h2>
        <p className="mt-1 text-sm text-charcoal-500">
          Excludes food cost already shown above. Negative amounts are credits
          or reversals, including corrections to earlier periods.
        </p>
        <div className="mt-4">
          <Table
            headers={["Category", "Recorded expense"]}
            empty={
              !rows(data, "balances").some(
                (a) =>
                  a.kind === "EXPENSE" &&
                  a.code !== "COGS" &&
                  paise(text(a, "period", "0")) !== 0n,
              )
            }
          >
            {rows(data, "balances")
              .filter(
                (a) =>
                  a.kind === "EXPENSE" &&
                  a.code !== "COGS" &&
                  paise(text(a, "period", "0")) !== 0n,
              )
              .map((a) => (
                <tr key={text(a, "id")}>
                  <Cell>{text(a, "name")}</Cell>
                  <Cell>{money(a.period)}</Cell>
                </tr>
              ))}
          </Table>
        </div>
        <p className="mt-3 text-sm font-bold">
          Total operating expenses: {money(data.expenses)}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows(data, "balances")
          .filter((a) => ["ASSET", "LIABILITY"].includes(text(a, "kind")))
          .filter((a) => text(a, "balance") !== "0.00")
          .map((a) => (
            <Stat
              key={text(a, "id")}
              label={text(a, "name")}
              value={
                a.kind === "LIABILITY"
                  ? decimal(-paise(text(a, "balance", "0")))
                  : a.balance
              }
              detail={
                a.code === "CUSTOMER_CONTROL"
                  ? "Debit: customers owe; credit: customer advance/refund liability."
                  : a.code === "SUPPLIER_CONTROL"
                    ? "Credit: supplier dues; debit: supplier advance/credit."
                    : undefined
              }
            />
          ))}
      </div>
    </div>
  );
}
export function CashPanel({ data, reload }: { data: Row; reload: () => void }) {
  const [closing, setClosing] = useState<Row | null>(null),
    [reviewing, setReviewing] = useState<Row | null>(null),
    [coins, setCoins] = useState<Record<string, string>>({}),
    [preClosing, setPreClosing] = useState<Row | null>(null);
  const denominations = [
    "5000",
    "1000",
    "500",
    "100",
    "50",
    "20",
    "10",
    "5",
    "2",
    "1",
    "0.5",
  ];
  const count = denominations.reduce(
    (sum, d) =>
      sum +
      paise(d) * BigInt(/^\d{1,6}$/.test(coins[d] ?? "") ? coins[d] : "0"),
    0n,
  );

  return (
    <div className="space-y-5">
      <Notice>
        Count physical cash at opening and closing. Starting cash is existing
        money, not income. Cash received, refunds, expenses and transfers update
        the expected closing balance.
      </Notice>
      <div className="grid gap-4 md:grid-cols-2">
        {rows(data, "drawers").map((d) => (
          <article className="surface p-5" key={text(d, "id")}>
            <h2 className="text-lg font-bold">{text(d, "name")}</h2>
            <p className="mt-2 text-sm text-charcoal-500">Recorded balance</p>
            <p className="mt-1 text-2xl font-bold">{money(d.balance)}</p>
            {d.activeShift ? (
              <>
                <p className="mt-3 text-sm">
                  Open · {text(d, "activeShift.openedByName")}
                </p>
                <Button
                  className="mt-3"
                  variant="secondary"
                  onClick={() =>
                    setPreClosing({
                      ...object(d, "activeShift"),
                      balance: d.balance,
                    })
                  }
                >
                  Count & close shift
                </Button>
              </>
            ) : (
              <div className="mt-4">
                <Form
                  title="Open cash shift"
                  module="cash"
                  fields={[
                    {
                      name: "amount",
                      label: "Physical opening count (Rs.)",
                      type: "number",
                      min: "0",
                    },
                    { name: "note", label: "Opening note", required: false },
                  ]}
                  build={(v) => ({ ...v, action: "OPEN", drawerId: d.id })}
                  onDone={reload}
                  submitLabel="Open shift"
                />
              </div>
            )}
          </article>
        ))}
      </div>
      {preClosing && (
        <ClosingChecklist
          onCancel={() => setPreClosing(null)}
          onContinue={() => {
            setClosing(preClosing);
            setPreClosing(null);
            setTimeout(
              () =>
                document
                  .getElementById("cash-count-form")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              0,
            );
          }}
        />
      )}
      <div id="cash-count-form" className="scroll-mt-24" />
      {reviewing && (
        <Form
          key={text(reviewing, "id")}
          title="Review counted cash"
          description={
            "Difference: " +
            money(reviewing.variance) +
            ". Review acknowledges the recorded difference; it does not post another correction."
          }
          module="cash"
          fields={[note]}
          build={(v) => ({
            ...v,
            action: "REVIEW",
            shiftId: reviewing.id,
            amount: "0",
          })}
          onDone={() => {
            setReviewing(null);
            reload();
          }}
          submitLabel="Approve closing review"
        />
      )}
      {closing && (
        <Form
          key={text(closing, "id")}
          title="Close cash shift"
          description={
            "Expected cash now: " +
            money(closing.balance) +
            ". Enter the actual counted cash; explain any difference."
          }
          module="cash"
          fields={[
            {
              name: "method",
              label: "Count method",
              type: "select",
              value: "manual",
              options: [
                { value: "manual", label: "Enter total cash" },
                { value: "notes", label: "Count notes & coins" },
              ],
            },
            {
              name: "amount",
              label: "Actual cash counted (Rs.)",
              visible: (v) => v.method !== "notes",
              type: "number",
              min: "0",
            },
            note,
          ]}
          build={(v) => ({
            ...v,
            action: "CLOSE",
            shiftId: closing.id,
            amount: v.method === "notes" ? decimal(count) : v.amount,
            denominations:
              v.method === "notes"
                ? denominations.map((value) => ({
                    value,
                    count: Number(coins[value] || 0),
                  }))
                : undefined,
          })}
          onDone={() => {
            setClosing(null);
            setCoins({});
            reload();
          }}
          submitLabel="Record count & close"
        >
          {(v) => (
            <div className="space-y-3">
              {v.method === "notes" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {denominations.map((value) => (
                    <Input
                      key={value}
                      label={"Rs. " + value + " · pieces"}
                      type="number"
                      min="0"
                      max="100000"
                      step="1"
                      value={coins[value] || ""}
                      onChange={(e) =>
                        setCoins((c) => ({ ...c, [value]: e.target.value }))
                      }
                    />
                  ))}
                </div>
              )}
              <Notice>
                Physical total:{" "}
                {v.method === "notes" ? money(decimal(count)) : money(v.amount)}{" "}
                · Difference from last refresh:{" "}
                {v.method === "notes"
                  ? money(decimal(count - paise(text(closing, "balance", "0"))))
                  : /^\d+(?:\.\d{1,2})?$/.test(String(v.amount))
                    ? money(
                        decimal(
                          paise(String(v.amount)) -
                            paise(text(closing, "balance", "0")),
                        ),
                      )
                    : "—"}
                . Final expected cash is checked again when you close.
              </Notice>
            </div>
          )}
        </Form>
      )}
      <div className="flex flex-wrap gap-3">
        <h2 className="text-xl font-bold">Latest 100 shifts</h2>
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv(
              "cash-closings.csv",
              [
                "Drawer",
                "Cashier",
                "Opened",
                "Closed",
                "Expected",
                "Counted",
                "Difference",
                "Reviewer",
                "Reason",
              ],
              rows(data, "shifts").map((s) => [
                text(s, "drawer.name"),
                text(s, "openedByName"),
                text(s, "openedAt"),
                text(s, "closedAt"),
                text(s, "expectedCash"),
                text(s, "actualCash"),
                text(s, "variance"),
                text(s, "reviewedByName"),
                text(s, "closeNote"),
              ]),
            )
          }
        >
          Export closings
        </Button>
      </div>
      <Table
        headers={[
          "Drawer / cashier",
          "Opened",
          "Opening cash",
          "Expected",
          "Actual",
          "Difference",
          "Status / review",
          "Actions",
        ]}
        empty={!rows(data, "shifts").length}
      >
        {rows(data, "shifts").map((s) => (
          <tr key={text(s, "id")}>
            <Cell>
              {text(s, "drawer.name")}
              <p className="text-xs">{text(s, "openedByName")}</p>
            </Cell>
            <Cell>
              {new Date(text(s, "openedAt")).toLocaleString("en-PK", {
                timeZone: "Asia/Karachi",
              })}
            </Cell>
            <Cell>{money(s.openingCash)}</Cell>
            <Cell>{s.expectedCash === null ? "—" : money(s.expectedCash)}</Cell>
            <Cell>{s.actualCash === null ? "—" : money(s.actualCash)}</Cell>
            <Cell>{s.variance === null ? "—" : money(s.variance)}</Cell>
            <Cell>
              {s.closedAt ? "Closed" : "Open"}
              <p className="text-xs">{text(s, "closeNote")}</p>
              {Boolean(s.closedAt) && (
                <p className="text-xs font-semibold">
                  {s.reviewedAt
                    ? "Reviewed by " + text(s, "reviewedByName")
                    : s.closedById
                      ? "Awaiting review"
                      : "Legacy closing · unreviewed"}
                </p>
              )}
              <p className="text-xs">{text(s, "reviewNote")}</p>
            </Cell>
            <Cell>
              <div className="flex flex-wrap gap-2">
                {Boolean(s.closedAt) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void printBusinessSlip(
                        "Cash closing statement",
                        [
                          ["Drawer", text(s, "drawer.name")],
                          ["Cashier", text(s, "openedByName")],
                          ["Opened", text(s, "openedAt")],
                          ["Closed", text(s, "closedAt")],
                          ["Opening cash", money(s.openingCash)],
                          ["Expected cash", money(s.expectedCash)],
                          ["Counted cash", money(s.actualCash)],
                          ["Difference", money(s.variance)],
                          ["Reason", text(s, "closeNote")],
                          ["Reviewer", text(s, "reviewedByName", "Pending")],
                        ],
                        "Reviewer note: " + text(s, "reviewNote"),
                      ).catch((e) => toast.error(e.message))
                    }
                  >
                    Print closing
                  </Button>
                )}
                {Boolean(data.canReview) &&
                  Boolean(s.closedAt) &&
                  !s.reviewedAt && (
                    <Button size="sm" onClick={() => setReviewing(s)}>
                      Review closing
                    </Button>
                  )}
              </div>
            </Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}
export function LedgerPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Trial balance · debits" value={data.trialDebit} />
        <Stat label="Trial balance · credits" value={data.trialCredit} />
      </div>
      <Notice>
        Posted entries are retained. Corrections create a linked reversal. Tax
        collected, supplier dues, customer advances and salary liabilities stay
        separate from operating profit.
      </Notice>
      <Table
        headers={["Account", "Type", "Balance (debit positive)"]}
        empty={!rows(data, "balances").length}
      >
        {rows(data, "balances").map((a) => (
          <tr key={text(a, "id")}>
            <Cell>
              {text(a, "name")}
              <span className="block text-xs text-charcoal-500">
                {text(a, "code")}
              </span>
            </Cell>
            <Cell>{text(a, "kind")}</Cell>
            <Cell>{money(a.balance)}</Cell>
          </tr>
        ))}
      </Table>
      <h2 className="text-xl font-bold">Party balances</h2>
      <Table
        headers={["Name", "Type", "Account", "Balance (debit positive)"]}
        empty={!rows(data, "partyBalances").length}
      >
        {rows(data, "partyBalances").map((p, i) => (
          <tr key={i}>
            <Cell>{text(p, "party.name")}</Cell>
            <Cell>{text(p, "party.kind")}</Cell>
            <Cell>{text(p, "account")}</Cell>
            <Cell>{money(p.balance)}</Cell>
          </tr>
        ))}
      </Table>
      <h2 className="text-xl font-bold">
        Posted ledger · latest 200 entries in this range
      </h2>
      <JournalList data={data} reload={reload} />
    </div>
  );
}
export function SetupPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const readiness = object(data, "readiness"),
    config = object(data, "config");
  return (
    <div className="space-y-5">
      <Notice>
        Start with actual opening cash/bank balances, supplier/customer dues,
        staff advances and ingredient stock values. Recipes are required for
        available food products. Activation applies to new orders; it does not
        rewrite old sales.
      </Notice>
      <div className="surface p-5">
        <h2 className="text-lg font-bold">Setup readiness</h2>
        <p className="mt-3 text-sm">
          Ingredients: {text(readiness, "ingredients")} · Missing food recipes:{" "}
          {rows(readiness, "missingRecipes").length}
        </p>
        {rows(readiness, "missingRecipes").length > 0 && (
          <p className="mt-2 text-sm text-chilli-600">
            {rows(readiness, "missingRecipes")
              .map((p) => text(p, "name"))
              .join(", ")}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="btn-secondary"
            href="/admin/business?section=inventory"
          >
            Opening ingredient stock
          </Link>
          <Link
            className="btn-secondary"
            href="/admin/business?section=expenses"
          >
            Opening cash / bank
          </Link>
          <Link
            className="btn-secondary"
            href="/admin/business?section=recipes"
          >
            Configure recipes
          </Link>
        </div>
      </div>
      <Form
        key={"config:" + text(config, "updatedAt")}
        title="Automatic order integration"
        module="setup"
        fields={[
          {
            name: "enabled",
            label:
              "Enable recipe reservations, consumption and financial posting for new orders",
            type: "checkbox",
            value: Boolean(config.enabled),
          },
          note,
        ]}
        build={(v) => ({ ...v, action: "CONFIG" })}
        onDone={reload}
        submitLabel="Save integration setting"
      />
      {!data.integrationActive && (
        <Form
          title="Opening party balance"
          description="Opening balances affect assets, liabilities and equity; they are not new sales or expenses."
          module="opening"
          fields={[
            {
              name: "partyId",
              label: "Supplier / customer / employee",
              type: "select",
              options: rows(data, "parties").map((p) => ({
                value: text(p, "id"),
                label: text(p, "name") + " · " + text(p, "kind"),
              })),
            },
            {
              name: "kind",
              label: "Balance type",
              type: "select",
              options: [
                { value: "SUPPLIER_DUE", label: "Supplier amount payable" },
                { value: "CUSTOMER_DUE", label: "Customer amount receivable" },
                { value: "SALARY_DUE", label: "Unpaid staff salary" },
                {
                  value: "STAFF_ADVANCE",
                  label: "Staff advance still to recover",
                },
              ],
            },
            {
              name: "amount",
              label: "Opening amount (Rs.)",
              type: "number",
              min: "0.01",
            },
            {
              name: "date",
              label: "Opening date",
              type: "date",
              value: text(data, "today"),
            },
            note,
          ]}
          build={(v) => ({ ...v })}
          onDone={reload}
          submitLabel="Record opening balance"
        />
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        <Form
          title="Create cash drawer / bank account"
          module="setup"
          fields={[
            { name: "name", label: "Account name" },
            {
              name: "kind",
              label: "Account type",
              type: "select",
              options: [
                { value: "CASH", label: "Cash drawer" },
                { value: "BANK", label: "Bank account" },
                { value: "WALLET", label: "Digital wallet" },
              ],
              value: "BANK",
            },
          ]}
          build={(v) => ({ ...v, action: "ACCOUNT" })}
          onDone={reload}
        />
        <Form
          title="Staff access"
          description="Owner/Admin accounts retain full access. Select a profile, then optionally restrict this individual login to selected modules. With custom access enabled, no checked modules means no access. Owner-only payroll and ledger remain protected."
          module="setup"
          fields={[
            {
              name: "userId",
              label: "Staff login",
              type: "select",
              options: rows(data, "users").map((u) => ({
                value: text(u, "id"),
                label: text(u, "name") + " · " + text(u, "email"),
              })),
            },
            {
              name: "profile",
              label: "Access profile",
              type: "select",
              options: ["MANAGER", "CASHIER", "WAITER", "CHEF"].map(
                (value) => ({ value, label: value }),
              ),
            },
            {
              name: "employeeId",
              label: "Employee record",
              type: "select",
              required: false,
              options: rows(data, "employees").map((e) => ({
                value: text(e, "id"),
                label: text(e, "code") + " · " + text(e, "party.name"),
              })),
            },
            {
              name: "customPermissions",
              label: "Restrict this login to individual permissions",
              type: "checkbox",
            },
            ...BUSINESS_CAPABILITIES.map((cap) => ({
              name: `permission_${cap}`,
              label: `Allow ${cap.replaceAll("-", " ")}`,
              type: "checkbox" as const,
              visible: (v: Record<string, string | boolean>) =>
                Boolean(v.customPermissions) &&
                profileCapabilities(String(v.profile)).includes(cap),
            })),
          ]}
          build={(v) => ({
            ...v,
            action: "ACCESS",
            customPermissions: Boolean(v.customPermissions),
            permissions: v.customPermissions
              ? profileCapabilities(String(v.profile)).filter(
                  (cap) => v[`permission_${cap}`],
                )
              : [],
            employeeId: v.employeeId || null,
          })}
          onDone={reload}
        />
      </div>
      <Form
        title="Close an accounting period"
        description="Entries dated on or before this date become locked. Closing dates can only move forward."
        module="setup"
        fields={[
          {
            name: "lockedThrough",
            label: "Lock through",
            type: "date",
            value: day(config.lockedThrough),
            max: text(data, "today"),
          },
          note,
        ]}
        build={(v) => ({ ...v, action: "CONFIG" })}
        onDone={reload}
        submitLabel="Lock accounting dates"
      />
    </div>
  );
}
export function ReceivablesPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  return (
    <div className="space-y-5">
      <Notice>
        Record customer credit collections here. Receipts are allocated to their
        delivered credit orders first, then to an opening balance. This is
        collection of an existing balance, not a second sale.
      </Notice>
      <Form
        title="Receive customer payment"
        module="payments"
        fields={[
          {
            name: "partyId",
            label: "Credit customer",
            type: "select",
            options: options(rows(data, "parties")),
          },
          {
            name: "amount",
            label: "Received amount (Rs.)",
            type: "number",
            min: "0.01",
          },
          {
            name: "accountId",
            label: "Received into",
            type: "select",
            options: options(rows(data, "accounts")),
          },
          {
            name: "date",
            label: "Receipt date",
            type: "date",
            value: text(data, "today"),
          },
          note,
        ]}
        build={(v) => ({ ...v, kind: "CUSTOMER_RECEIPT" })}
        onDone={reload}
        submitLabel="Record collection"
      />
      <Table
        headers={["Customer", "Phone", "Outstanding balance"]}
        empty={!rows(data, "parties").length}
      >
        {rows(data, "parties").map((p) => (
          <tr key={text(p, "id")}>
            <Cell>{text(p, "name")}</Cell>
            <Cell>{text(p, "phone")}</Cell>
            <Cell>{money(p.balance)}</Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}

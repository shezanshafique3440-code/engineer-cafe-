"use client";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useSession } from "@/context/session-context";
import { useMoney } from "@/context/settings-context";
import { PageHeader } from "./ui";
import {
  OperationForm,
  OperationsTable,
  type FormSpec,
  type Field,
  type Choice,
} from "./operations-ui";
import type { readOperations } from "@/server/operations";
import type { Prisma } from "@prisma/client";

type Json<T> = T extends Date
  ? string
  : T extends Prisma.Decimal
    ? string
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;
type Result = Json<Awaited<ReturnType<typeof readOperations>>>;
const txt = (name: string, label: string, optional = false): Field => ({
  name,
  label,
  optional,
});
const num = (name: string, label: string, value?: number): Field => ({
  name,
  label,
  type: "number",
  value,
});
const sel = (
  name: string,
  label: string,
  options: Choice[],
  optional = false,
): Field => ({ name, label, type: "select", options, optional });
const yes = (name: string, label: string, value = false): Field => ({
  name,
  label,
  type: "checkbox",
  value,
});
const opts = (rows: { id: string; name: string }[]) =>
  rows.map((r) => ({ value: r.id, label: r.name }));
const date = (s: string | null) =>
  s ? new Date(s).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) : "—";
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(
    new Date(),
  );

export function OperationsManager({
  module,
}: {
  module: "inventory" | "people" | "shifts" | "delivery" | "finance";
}) {
  const { user } = useSession();
  const money = useMoney();
  const [data, setData] = useState<Result | null>(null),
    [error, setError] = useState("");
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(today);
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    try {
      setData(
        await apiGet<Result>(
          `/api/admin/operations/${module}?from=${from}&to=${to}`,
        ),
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load records.");
    }
  }, [module, from, to]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const submit = async (body: Record<string, unknown>) => {
    await apiPost(`/api/admin/operations/${module}`, body);
    setNotice("Saved successfully.");
    await refresh();
  };
  const titles = {
    inventory: "Inventory & purchases",
    people: "Employees & access",
    shifts: "Cashier shifts",
    delivery: "Riders & commissions",
    finance: "Financial reports",
  };
  const forms: FormSpec[] = [];
  const tables: React.ReactNode[] = [];
  const addTable = (
    title: string,
    headers: string[],
    rows: React.ReactNode[][],
  ) =>
    tables.push(
      <OperationsTable
        key={title}
        title={title}
        headers={headers}
        rows={rows}
      />,
    );
  if (data && module === "inventory") {
    const d = data as Extract<Result, { items: unknown }>;
    const items = opts(d.items),
      suppliers = opts(d.suppliers);
    forms.push(
      {
        title: "Add inventory item",
        action: "item",
        fields: [
          txt("name", "Name"),
          txt("unit", "Base unit (g, ml, piece)"),
          num("lowStock", "Low-stock threshold", 0),
        ],
      },
      {
        title: "Add supplier",
        action: "supplier",
        fields: [
          txt("name", "Name"),
          txt("phone", "Phone", true),
          txt("address", "Address", true),
        ],
      },
      {
        title: "Update inventory item",
        action: "item-update",
        fields: [
          sel("itemId", "Ingredient", items),
          txt("name", "Name"),
          { ...num("lowStock", "Low-stock threshold"), step: "0.001" },
          yes("isActive", "Active", true),
        ],
        hint: "Base units stay fixed to preserve purchase and recipe history.",
      },
      {
        title: "Update supplier",
        action: "supplier-update",
        fields: [
          sel("supplierId", "Supplier", suppliers),
          txt("name", "Name"),
          txt("phone", "Phone", true),
          txt("address", "Address", true),
          yes("isActive", "Active", true),
        ],
      },
      {
        title: "Record purchase",
        action: "purchase",
        fields: [
          sel("supplierId", "Supplier", suppliers),
          txt("reference", "Unique invoice reference"),
        ],
        lines: { options: items, cost: true },
        hint: "Quantities use each ingredient's base unit. Stock and weighted-average cost update together. Invoice references cannot be reused.",
      },
      {
        title: "Record vendor payment",
        action: "vendor-payment",
        fields: [
          sel("supplierId", "Supplier", suppliers),
          num("amount", "Paid (Rs.)"),
          txt("reference", "Unique payment reference"),
        ],
        hint: "Positive balance means payable; negative means supplier credit. This is a payment, not a second purchase expense.",
      },
      {
        title: "Set product recipe",
        action: "recipe",
        fields: [sel("productId", "Product", opts(d.products))],
        lines: { options: items },
        hint: "Replaces the complete recipe. Enter base units used by one product. Historical sale costs stay unchanged.",
      },
      {
        title: "Adjust inventory",
        action: "adjust",
        fields: [
          sel("inventoryItemId", "Ingredient", items),
          {
            ...num("quantity", "Signed quantity (+ stock / − wastage)"),
            step: "0.001",
          },
          txt("reason", "Reason"),
        ],
        hint: "Use purchases for deliveries from suppliers. Adjustments are permanently recorded in the stock ledger.",
      },
    );
    addTable(
      "Ingredient stock",
      ["Item", "Available", "Low threshold", "Average cost / base unit"],
      d.items.map((i) => [
        i.name,
        `${i.quantity} ${i.unit}${i.low ? " · LOW" : ""}`,
        `${i.lowStock} ${i.unit}`,
        `Rs. ${Number(i.averageCost).toFixed(4)}`,
      ]),
    );
    addTable(
      "Suppliers & balances",
      ["Supplier", "Phone", "Payable / (credit)"],
      d.suppliers.map((s) => [s.name, s.phone, money(s.balance)]),
    );
    addTable(
      "Purchase history",
      ["Invoice", "Supplier", "Items", "Total", "Date"],
      d.purchases.map((p) => [
        p.reference,
        p.supplier.name,
        p.lines
          .map(
            (l) =>
              `${l.item.name}: ${l.quantity} × ${`Rs. ${Number(l.unitCost).toFixed(4)}`}`,
          )
          .join("; "),
        money(p.total),
        date(p.createdAt),
      ]),
    );
    addTable(
      "Recipes & active products",
      ["Product", "Available", "Sold", "Recipe"],
      d.products.map((p) => [
        p.name,
        p.isAvailable ? "Yes" : "No",
        p.soldCount,
        p.recipe
          .map(
            (r) =>
              `${d.items.find((i) => i.id === r.inventoryItemId)?.name}: ${r.quantity}`,
          )
          .join("; ") || "Cost not configured",
      ]),
    );
    addTable(
      "Stock ledger",
      ["Date", "Item", "Change", "Reason"],
      d.movements.map((m) => [
        date(m.createdAt),
        m.item.name,
        String(m.quantity),
        m.reason,
      ]),
    );
  }
  if (data && module === "people") {
    const d = data as Extract<Result, { employees: unknown }>;
    const employees = opts(d.employees);
    forms.push(
      {
        title: "Add employee",
        action: "employee",
        fields: [
          txt("name", "Full name"),
          txt("title", "Job title"),
          txt("phone", "Phone", true),
          num("monthlySalary", "Monthly salary (Rs.)"),
          sel("userId", "Link login (optional)", opts(d.users), true),
        ],
      },
      {
        title: "Update employee",
        action: "employee-update",
        fields: [
          sel("employeeId", "Employee", employees),
          txt("name", "Full name"),
          txt("title", "Job title"),
          txt("phone", "Phone", true),
          num("monthlySalary", "Monthly salary (Rs.)"),
          yes("isActive", "Active", true),
        ],
      },
      {
        title: "Record attendance",
        action: "attendance",
        fields: [
          sel("employeeId", "Employee", employees),
          yes("clockOut", "Clock out (leave unchecked to clock in)"),
        ],
        hint: "Uses current time and the cafe's Asia/Karachi business date. Overnight check-outs close the open record.",
      },
      {
        title: "Pay salary",
        action: "salary",
        fields: [
          sel("employeeId", "Employee", employees),
          {
            ...txt("period", "Salary period (YYYY-MM)"),
            value: today().slice(0, 7),
          },
          num("amount", "Paid (Rs.)"),
          txt("reference", "Unique payment reference"),
        ],
        hint: "One recorded salary payment per employee and month. Enter the agreed amount; the ledger preserves history.",
      },
    );
    if (user?.role === "ADMIN")
      forms.push(
        {
          title: "Create staff / administrator login",
          action: "user",
          fields: [
            txt("name", "Full name"),
            { ...txt("email", "Email"), type: "email" },
            {
              ...txt("password", "Password (at least 12 characters)"),
              type: "password",
            },
            sel("role", "Role", [
              { value: "STAFF", label: "Staff" },
              { value: "ADMIN", label: "Administrator" },
            ]),
            {
              name: "permissions",
              label: "Staff permissions (Ctrl/Cmd to select several)",
              type: "multi",
              optional: true,
              options: d.permissions.map((p) => ({ value: p, label: p })),
            },
          ],
          hint: "Administrators have all permissions. Staff have only the selected grants. Supports separate accounts for every cashier.",
        },
        {
          title: "Change individual access",
          action: "access",
          fields: [
            sel("userId", "User", opts(d.users)),
            sel(
              "role",
              "Role",
              ["CUSTOMER", "STAFF", "ADMIN"].map((value) => ({
                value,
                label: value,
              })),
            ),
            yes("isActive", "Active", true),
            {
              name: "permissions",
              label: "Complete permission set",
              type: "multi",
              optional: true,
              options: d.permissions.map((p) => ({ value: p, label: p })),
            },
          ],
          hint: "This replaces the selected user's grants. You cannot change your own access. Changes are checked on the next request.",
        },
      );
    addTable(
      "Employees",
      ["Name", "Job", "Salary / month", "Active", "Paid this month"],
      d.employees.map((e) => [
        e.name,
        e.title,
        money(e.monthlySalary),
        e.isActive ? "Yes" : "No",
        money(
          e.salaryPayments
            .filter((p) => p.period === today().slice(0, 7))
            .reduce((s, p) => s + p.amount, 0),
        ),
      ]),
    );
    addTable(
      "Attendance",
      ["Employee", "Business date", "Clock in", "Clock out", "Hours"],
      d.employees.flatMap((e) =>
        e.attendance.map((a) => [
          e.name,
          a.day,
          date(a.clockIn),
          date(a.clockOut),
          a.clockOut
            ? (
                (new Date(a.clockOut).getTime() -
                  new Date(a.clockIn).getTime()) /
                3600000
              ).toFixed(2)
            : "Open",
        ]),
      ),
    );
    addTable(
      "Salary ledger",
      ["Employee", "Period", "Amount", "Reference", "Paid"],
      d.employees.flatMap((e) =>
        e.salaryPayments.map((p) => [
          e.name,
          p.period,
          money(p.amount),
          p.reference,
          date(p.paidAt),
        ]),
      ),
    );
    if (user?.role === "ADMIN")
      addTable(
        "Login permissions",
        ["Name", "Email", "Role", "Active", "Grants"],
        d.users.map((u) => [
          u.name,
          u.email,
          u.role,
          u.isActive ? "Yes" : "No",
          u.role === "ADMIN" ? "All" : u.permissions.join(", "),
        ]),
      );
  }
  if (data && module === "shifts") {
    const d = data as Extract<Result, { shifts: unknown }>;
    const open = d.shifts
      .filter((s) => !s.closedAt && s.cashierId === user?.id)
      .map((s) => ({
        value: s.id,
        label: `${s.cashier.name} · ${date(s.openedAt)}`,
      }));
    forms.push(
      {
        title: "Open my shift",
        action: "open",
        fields: [num("openingCash", "Opening cash (Rs.)")],
        hint: "Count the drawer first. Each cashier can have one open shift.",
      },
      {
        title: "Record cash in / out",
        action: "movement",
        fields: [
          sel("shiftId", "My shift", open),
          num("amount", "Signed amount (+ in / − out)"),
          txt("reason", "Reason / expense reference"),
        ],
        hint: "Record drawer withdrawals and deposits separately from business expenses. Sale payments are included automatically.",
      },
      {
        title: "Close & reconcile shift",
        action: "close",
        fields: [
          sel("shiftId", "My shift", open),
          num("closingCash", "Actual counted cash (Rs.)"),
          sel(
            "handoverToId",
            "Handover to (optional)",
            opts(d.cashiers.filter((c) => c.id !== user?.id)),
            true,
          ),
          txt("note", "Handover / variance note", true),
        ],
        hint: "Expected = opening + cash received − refunds + signed drawer movements. Closing freezes the reconciliation. The next cashier opens their own shift with the counted handover.",
      },
    );
    addTable(
      "Shifts & reconciliation",
      [
        "Cashier",
        "Opened",
        "Closed",
        "Sales",
        "Opening",
        "Expected",
        "Counted",
        "Variance",
        "Handover",
      ],
      d.shifts.map((s) => [
        s.cashier.name,
        date(s.openedAt),
        date(s.closedAt),
        money(s.sales),
        money(s.openingCash),
        money(s.expectedCash ?? s.liveExpected),
        s.closingCash === null ? "Open" : money(s.closingCash),
        s.variance === null ? "—" : money(s.variance),
        d.cashiers.find((c) => c.id === s.handoverToId)?.name || s.note,
      ]),
    );
    addTable(
      "Drawer ledger",
      ["Cashier", "Date", "Amount", "Reason"],
      d.shifts.flatMap((s) =>
        s.movements.map((m) => [
          s.cashier.name,
          date(m.createdAt),
          money(m.amount),
          m.reason,
        ]),
      ),
    );
    addTable(
      "Cash receipts & refunds",
      ["Cashier", "Date", "Amount", "Method", "Reference"],
      d.shifts.flatMap((s) =>
        s.payments.map((p) => [
          s.cashier.name,
          date(p.createdAt),
          money(p.amount),
          p.method,
          p.reference,
        ]),
      ),
    );
  }
  if (data && module === "delivery") {
    const d = data as Extract<Result, { riders: unknown }>;
    forms.push(
      {
        title: "Add rider",
        action: "rider",
        fields: [
          txt("code", "Unique rider code"),
          txt("name", "Name"),
          txt("phone", "Phone"),
        ],
      },
      {
        title: "Update rider",
        action: "rider-update",
        fields: [
          sel("riderId", "Rider", opts(d.riders)),
          txt("name", "Name"),
          txt("phone", "Phone"),
          yes("isActive", "Active", true),
        ],
      },
      {
        title: "Update delivery status",
        action: "status",
        fields: [
          sel(
            "orderId",
            "Order",
            d.orders.map((o) => ({
              value: o.id,
              label: `${o.orderNumber} · ${o.status}`,
            })),
          ),
          sel(
            "status",
            "Next status",
            [
              "CONFIRMED",
              "PREPARING",
              "READY",
              "OUT_FOR_DELIVERY",
              "DELIVERED",
              "CANCELLED",
            ].map((value) => ({ value, label: value })),
          ),
        ],
        hint: "Move through preparation, ready, dispatch and delivery in order. Assign a rider before dispatch, record payment before delivery, and refund before cancelling a paid order.",
      },
      {
        title: "Assign delivery",
        action: "assign",
        fields: [
          sel("riderId", "Rider", opts(d.riders.filter((r) => r.isActive))),
          sel(
            "orderId",
            "Order",
            d.orders
              .filter(
                (o) => !["DELIVERED", "OUT_FOR_DELIVERY"].includes(o.status),
              )
              .map((o) => ({
                value: o.id,
                label: `${o.orderNumber} · ${o.customerName}`,
              })),
          ),
        ],
        hint: "Commission is 15% of food subtotal after discounts, excluding delivery and tax; rounded to whole rupees. It accrues only on completed delivery.",
      },
      {
        title: "Settle rider commission",
        action: "settle",
        fields: [
          sel("riderId", "Rider", opts(d.riders)),
          {
            name: "orderIds",
            label: "Delivered orders to settle (Ctrl/Cmd for several)",
            type: "multi",
            options: d.orders
              .filter(
                (o) =>
                  o.status === "DELIVERED" && o.riderId && !o.commissionPaidAt,
              )
              .map((o) => ({
                value: o.id,
                label: `${o.orderNumber} · ${o.rider?.name} · ${money(o.commission)}`,
              })),
          },
        ],
        hint: "Requires finance permission. Only selected delivered, paid, unsettled orders for that rider are included.",
      },
    );
    addTable(
      "Rider performance & commission",
      [
        "Code",
        "Rider",
        "Phone",
        "Active jobs",
        "Delivered",
        "Average minutes",
        "Earned",
        "Due",
      ],
      d.riders.map((r) => [
        r.code,
        `${r.name}${r.isActive ? "" : " (inactive)"}`,
        r.phone,
        r.active,
        r.delivered,
        r.averageMinutes,
        money(r.earned),
        money(r.due),
      ]),
    );
    addTable(
      "Total rider commission",
      ["Earned", "Unsettled"],
      [
        [
          money(d.riders.reduce((sum, r) => sum + r.earned, 0)),
          money(d.riders.reduce((sum, r) => sum + r.due, 0)),
        ],
      ],
    );
    addTable(
      "Delivery tracking",
      [
        "Order",
        "Customer",
        "Rider",
        "Status",
        "Payment",
        "Commission",
        "Settled",
      ],
      d.orders.map((o) => [
        o.orderNumber,
        o.customerName,
        o.rider?.name || "Unassigned",
        o.status,
        o.paymentStatus,
        money(o.commission),
        date(o.commissionPaidAt),
      ]),
    );
  }
  if (data && module === "finance") {
    const d = data as Extract<Result, { summary: unknown }>;
    forms.push({
      title: "Record business expense",
      action: "expense",
      fields: [
        txt("category", "Category"),
        txt("description", "Description"),
        num("amount", "Expense (Rs.)"),
        txt("reference", "Unique reference"),
      ],
      hint: "Use salary and commission workflows for those payments, and purchases for inventory. Avoid entering the same cost twice.",
    });
    const s = d.summary;
    addTable(
      "Business financial overview",
      ["Measure", "Value"],
      Object.entries(s).map(([k, v]) => [
        k.replace(/([A-Z])/g, " $1"),
        v === null
          ? "Unavailable: historical costs missing"
          : ["orders", "missingCostOrders", "lowStockItems"].includes(k)
            ? v
            : money(v),
      ]),
    );
    addTable(
      "Daily sales",
      ["Date", "Orders", "Sales incl. tax & delivery"],
      d.daily.map((r) => [r.date, r.orders, money(r.sales)]),
    );
    addTable(
      "Product sales & best sellers",
      ["Product", "Units", "Gross before order discounts", "Recorded cost"],
      d.products.map((p) => [
        p.name,
        p.quantity,
        money(p.gross),
        money(p.cost),
      ]),
    );
    addTable(
      "Cashier sales",
      ["Cashier", "Completed orders", "Sales"],
      d.cashiers.map((c) => [c.name, c.orders, money(c.sales)]),
    );
    addTable(
      "Vendor balances at range end",
      ["Vendor", "Purchases", "Payments", "Balance / (credit)"],
      d.vendors.map((v) => [
        v.name,
        money(v.purchased),
        money(v.paid),
        money(v.balance),
      ]),
    );
    addTable(
      "Expenses",
      ["Date", "Category", "Description", "Amount", "Reference"],
      d.expenses.map((e) => [
        date(e.incurredAt),
        e.category,
        e.description,
        money(e.amount),
        e.reference,
      ]),
    );
    addTable(
      "Salary payments",
      ["Employee", "Period", "Paid date", "Amount"],
      d.salaries.map((s) => [
        s.employee.name,
        s.period,
        date(s.paidAt),
        money(s.amount),
      ]),
    );
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title={titles[module]}
        description="Cafe operations · all money in PKR · business dates in Asia/Karachi"
        action={
          <button className="text-sm underline" onClick={() => void refresh()}>
            Refresh
          </button>
        }
      />
      {module === "finance" && (
        <section className="surface flex flex-wrap items-end gap-3 p-4">
          <label className="grid text-sm">
            From
            <input
              className="field"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="grid text-sm">
            Through
            <input
              className="field"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          {[1, 7, 30, 365].map((days) => (
            <button
              className="rounded-lg border p-2 text-sm"
              key={days}
              onClick={() => {
                const end = today();
                const start = new Date(`${end}T00:00:00Z`);
                if (days === 7)
                  start.setUTCDate(
                    start.getUTCDate() - ((start.getUTCDay() + 6) % 7),
                  );
                if (days === 30) start.setUTCDate(1);
                if (days === 365) {
                  start.setUTCMonth(0, 1);
                }
                setFrom(start.toISOString().slice(0, 10));
                setTo(end);
              }}
            >
              {days === 1
                ? "Today"
                : days === 7
                  ? "Week"
                  : days === 30
                    ? "Month"
                    : "Year"}
            </button>
          ))}
          <button
            className="rounded-lg border p-2 text-sm"
            onClick={() => {
              if (!data || !("summary" in data)) return;
              const rows = [
                ["Measure", "Value"],
                ...Object.entries(data.summary),
                [],
                ["Product", "Units", "Gross", "Cost"],
                ...data.products.map((p) => [
                  p.name,
                  p.quantity,
                  p.gross,
                  p.cost,
                ]),
              ];
              const csv = rows
                .map((r) =>
                  r
                    .map(
                      (v) =>
                        `"${String(v ?? "Unknown")
                          .replace(/^[=+@-]/, "'$&")
                          .replaceAll('"', '""')}"`,
                    )
                    .join(","),
                )
                .join("\r\n");
              const link = document.createElement("a");
              link.href = URL.createObjectURL(
                new Blob([csv], { type: "text/csv" }),
              );
              link.download = `cafe-report-${from}-${to}.csv`;
              link.click();
              URL.revokeObjectURL(link.href);
            }}
          >
            Export CSV
          </button>
        </section>
      )}
      {module === "finance" && (
        <p className="text-sm text-charcoal-500">
          Sales count paid, completed orders. Profit excludes collected tax and
          includes delivery fees; ingredient cost, operating expenses, salary
          payments and earned commission are deducted. Inventory purchases are
          assets until consumed. Missing recipes or historical costs make profit
          unavailable. Inventory value is current; vendor balances are at the
          selected range end.
        </p>
      )}
      {error && (
        <p className="surface p-4 text-chilli-600" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-circuit-600">
          {notice}
        </p>
      )}
      {!data && !error && <p>Loading…</p>}
      <div className="grid items-start gap-3 xl:grid-cols-2">
        {forms.map((spec) => (
          <OperationForm key={spec.action} spec={spec} submit={submit} />
        ))}
      </div>
      {tables}
    </div>
  );
}

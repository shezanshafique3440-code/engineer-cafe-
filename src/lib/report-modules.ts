/** Shared labels and fixed sheet membership for separate business workbooks. */
export const REPORT_MODULES = [
  {
    id: "orders",
    label: "Orders & sales",
    file: "Orders",
    sections: ["sales"],
    sheets: [
      "Orders",
      "Order items",
      "Item add-ons",
      "Order history",
      "Posted sales and costs",
      "Payments",
    ],
  },
  {
    id: "inventory",
    label: "Inventory & recipes",
    file: "Inventory",
    sections: ["inventory", "recipes", "stockcounts"],
    sheets: [
      "Current ingredients",
      "Stock movements",
      "Stock counts",
      "Stock reservations",
      "Current recipes",
    ],
  },
  {
    id: "purchases",
    label: "Purchases & suppliers",
    file: "Purchases",
    sections: ["purchases", "procurement", "suppliers"],
    sheets: [
      "Purchases",
      "Purchase items",
      "Purchase orders",
      "Current parties",
      "Payments",
    ],
  },
  {
    id: "employees",
    label: "Employees, attendance & salaries",
    file: "Employees",
    sections: ["staff", "attendance", "payroll"],
    sheets: ["Current employees", "Attendance", "Payroll", "Payments"],
  },
  {
    id: "cash",
    label: "Cash shifts",
    file: "Cash-Shifts",
    sections: ["cash"],
    sheets: ["Cash shifts"],
  },
  {
    id: "riders",
    label: "Riders & deliveries",
    file: "Riders",
    sections: ["delivery"],
    sheets: [
      "Current riders",
      "Deliveries",
      "Rider commissions",
      "Rider settlements",
    ],
  },
  {
    id: "financial",
    label: "Financial report",
    file: "Financial-Report",
    sections: ["overview", "ledger", "expenses", "setup"],
    sheets: ["Payments", "Journals", "Ledger entries", "Expenses"],
  },
  {
    id: "customers",
    label: "Customers & credit",
    file: "Customers",
    sections: ["customers", "receivables"],
    sheets: ["Current customers", "Loyalty entries", "Current parties"],
  },
  {
    id: "operations",
    label: "Menu, tables & approvals",
    file: "Menu-Tables-Approvals",
    sections: ["tables", "approvals", "audit"],
    sheets: [
      "Current products",
      "Current add-ons",
      "Current coupons",
      "Current tables",
      "Table sessions",
      "Approvals",
      "Change history",
    ],
  },
] as const;
export type ReportModule = (typeof REPORT_MODULES)[number]["id"];
export function findReportModule(id: string) {
  return REPORT_MODULES.find((module) => module.id === id);
}

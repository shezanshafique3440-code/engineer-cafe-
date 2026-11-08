import { canBusiness } from "./business-access";
import type { SessionUser } from "./types";

export type CafeTask = {
  id: string;
  label: string;
  hint: string;
  href: string;
  cap: string;
  group: "daily" | "stock" | "team" | "owner";
};
export const CAFE_TASKS: CafeTask[] = [
  {
    id: "pos",
    label: "New sale",
    hint: "Choose items, take payment, print a receipt",
    href: "/admin/pos",
    cap: "pos",
    group: "daily",
  },
  {
    id: "tables",
    label: "Tables & orders",
    hint: "Open a table, add items and settle the bill",
    href: "/admin/business?section=tables",
    cap: "tables",
    group: "daily",
  },
  {
    id: "kitchen",
    label: "Kitchen orders",
    hint: "View new orders and prepare them",
    href: "/admin/kitchen",
    cap: "kitchen",
    group: "daily",
  },
  {
    id: "orders",
    label: "All orders",
    hint: "Website orders, pickups and order status",
    href: "/admin/orders",
    cap: "orders",
    group: "daily",
  },
  {
    id: "delivery",
    label: "Riders & deliveries",
    hint: "Assign deliveries, collect cash and review commission",
    href: "/admin/business?section=delivery",
    cap: "delivery",
    group: "daily",
  },
  {
    id: "cash",
    label: "Cash opening / closing",
    hint: "Open your drawer or count cash to close your shift",
    href: "/admin/business?section=cash",
    cap: "cash",
    group: "daily",
  },
  {
    id: "purchases",
    label: "Receive purchases",
    hint: "Enter the supplier invoice and stock received",
    href: "/admin/business?section=purchases",
    cap: "purchases",
    group: "stock",
  },
  {
    id: "inventory",
    label: "Stock levels",
    hint: "Ingredient quantities and stock movements",
    href: "/admin/business?section=inventory",
    cap: "stock-read",
    group: "stock",
  },
  {
    id: "stockcounts",
    label: "Count stock",
    hint: "Count actual stock and review differences",
    href: "/admin/business?section=stockcounts",
    cap: "inventory",
    group: "stock",
  },
  {
    id: "expenses",
    label: "Record expenses",
    hint: "Record rent, utilities and other actual expenses",
    href: "/admin/business?section=expenses",
    cap: "expenses",
    group: "stock",
  },
  {
    id: "attendance",
    label: "Attendance",
    hint: "Record attendance, leave and overtime",
    href: "/admin/business?section=attendance",
    cap: "attendance",
    group: "team",
  },
  {
    id: "staff",
    label: "Employees & salaries",
    hint: "Employee details and salary rates",
    href: "/admin/business?section=staff",
    cap: "payroll",
    group: "team",
  },
  {
    id: "payroll",
    label: "Pay salaries",
    hint: "Review the draft, post payroll and record payment",
    href: "/admin/business?section=payroll",
    cap: "payroll",
    group: "team",
  },
  {
    id: "overview",
    label: "Business overview",
    hint: "Sales, food cost and profit reports",
    href: "/admin/business?section=overview",
    cap: "reports",
    group: "owner",
  },
  {
    id: "receivables",
    label: "Collect customer credit",
    hint: "Record actual payments received from credit customers",
    href: "/admin/business?section=receivables",
    cap: "payments",
    group: "owner",
  },
  {
    id: "approvals",
    label: "Approvals",
    hint: "Review discount and refund requests",
    href: "/admin/business?section=approvals",
    cap: "payments",
    group: "owner",
  },
  {
    id: "setup",
    label: "Setup & staff access",
    hint: "Opening setup and staff login permissions",
    href: "/admin/business?section=setup",
    cap: "setup",
    group: "owner",
  },
];
export function tasksFor(user: SessionUser | null | undefined) {
  const tasks = CAFE_TASKS.filter((task) => canBusiness(user, task.cap));
  const first =
    user?.businessProfile === "WAITER"
      ? "tables"
      : user?.businessProfile === "CHEF"
        ? "kitchen"
        : user?.businessProfile === "CASHIER"
          ? "pos"
          : "overview";
  return [
    ...tasks.filter((t) => t.id === first),
    ...tasks.filter((t) => t.id !== first),
  ];
}
export const TASK_GUIDES: Record<
  string,
  { title: string; steps: string[]; tip: string }
> = {
  overview: {
    title: "Review sales and profit",
    steps: [
      "Choose dates",
      "Review sales and food cost",
      "Check profit and cash separately",
    ],
    tip: "Sales, profit and cash in the drawer are different figures. You can export the report.",
  },
  inventory: {
    title: "Check available stock",
    steps: [
      "Find an ingredient",
      "Check the quantity and unit",
      "Receive purchases or count stock",
    ],
    tip: "Use Purchases for stock received from suppliers. Do not add the same stock again as an opening adjustment.",
  },
  recipes: {
    title: "Set up a recipe",
    steps: [
      "Choose a menu item",
      "Enter ingredient quantities",
      "Save the recipe",
    ],
    tip: "Enter quantities in the ingredient stock unit. Recipes determine stock usage and food cost.",
  },
  purchases: {
    title: "Receive a supplier delivery",
    steps: [
      "Choose the supplier and invoice",
      "Enter items, quantities and costs",
      "Receive stock, then record actual payment",
    ],
    tip: "Enter only stock actually received. Credit invoices can be paid later.",
  },
  procurement: {
    title: "Order supplies",
    steps: [
      "Create a purchase order",
      "Approve and send the order",
      "Receive the delivery against an invoice",
    ],
    tip: "A purchase order does not increase stock. Stock increases when the received invoice is posted.",
  },
  stockcounts: {
    title: "Reconcile physical stock",
    steps: [
      "Choose ingredients",
      "Count actual quantities",
      "Review and post the difference",
    ],
    tip: "Enter the actual quantity counted. Do not change the count just to match the system.",
  },
  delivery: {
    title: "Manage deliveries and rider cash",
    steps: [
      "Assign a rider",
      "Complete the delivery",
      "Record cash received and commission paid",
    ],
    tip: "Commission is 15% of the net food amount. Do not collect rider cash again for counter-paid orders.",
  },
  tables: {
    title: "Serve and settle a table",
    steps: [
      "Open an available table",
      "Add items and send the ticket",
      "Receive payment, then close the table",
    ],
    tip: "Each table card shows the total, received amount and balance due. You can add more tickets to the same table.",
  },
  cash: {
    title: "Open and close your cash drawer",
    steps: [
      "Count opening cash",
      "Record payments during the day",
      "Review pending bills and count closing cash",
    ],
    tip: "Use the shift under your own login. Enter actual counted cash and explain any difference.",
  },
  expenses: {
    title: "Record an expense",
    steps: [
      "Choose the expense type",
      "Enter the amount and payment account",
      "Add a reference and save",
    ],
    tip: "Cash and bank transfers are not sales or expenses. Record supplier and salary payments in their own screens.",
  },
  staff: {
    title: "Set up employees",
    steps: [
      "Add an employee",
      "Enter pay rates and the joining date",
      "Link staff login access if needed",
    ],
    tip: "Employee records and staff logins are separate. Attendance and payroll use the employee record.",
  },
  attendance: {
    title: "Today's attendance",
    steps: [
      "Choose the employee and date",
      "Record attendance, leave and times",
      "Check overtime and save",
    ],
    tip: "Enter actual clock-in and clock-out in Pakistan time. Review attendance before calculating payroll.",
  },
  payroll: {
    title: "Prepare and pay salaries",
    steps: [
      "Prepare the payroll draft",
      "Review pay, advances and deductions",
      "Post payroll, then record actual payment",
    ],
    tip: "Preparing a draft does not pay salary. Record only payments actually made.",
  },
  receivables: {
    title: "Collect a credit balance",
    steps: [
      "Choose a customer",
      "Enter the actual amount and account",
      "Save the collection",
    ],
    tip: "Collecting an existing credit balance is not a new sale.",
  },
  suppliers: {
    title: "Review supplier balances",
    steps: [
      "Choose a supplier",
      "Check amounts due and advances",
      "Record an actual payment or refund",
    ],
    tip: "Invoices and supplier payments are separate records. Do not record the same payment twice.",
  },
  customers: {
    title: "Credit customers",
    steps: [
      "Create the customer record",
      "Check the credit limit",
      "Record payment in Credit collections",
    ],
    tip: "Only approved customers can receive credit sales.",
  },
  approvals: {
    title: "Review approval requests",
    steps: [
      "Check the request and amount",
      "Review the order or cart and reason",
      "Approve or reject",
    ],
    tip: "Approval does not itself make a payment or refund. Check the related payment status.",
  },
  ledger: {
    title: "Detailed financial record",
    steps: [
      "Choose a date range",
      "Review accounts and balances",
      "Export the report if needed",
    ],
    tip: "This is the detailed financial report. Daily totals are available in Business overview.",
  },
  audit: {
    title: "Review change history",
    steps: ["Choose dates", "Search staff or records", "Review change details"],
    tip: "History cannot be edited. Use the related screen to record a proper reversal or correction.",
  },
  setup: {
    title: "Complete opening setup",
    steps: [
      "Enter real stock and opening balances",
      "Set recipes and staff permissions",
      "Review readiness before activation",
    ],
    tip: "Opening setup is not a daily task. Do not enter existing opening balances again or disable active integration without a reason.",
  },
};

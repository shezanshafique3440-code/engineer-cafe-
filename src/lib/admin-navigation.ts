import { BUSINESS_SECTIONS, canBusiness } from "./business-access";
import { CAFE_TASKS } from "./cafe-tasks";
import type { SessionUser } from "./types";

export type AdminTool = {
  id: string;
  href: string;
  label: string;
  hint: string;
  cap: string;
  group: string;
  icon: string;
  ownerOnly?: boolean;
};
export const TOOL_GROUPS = [
  { id: "daily", label: "Daily counter" },
  { id: "service", label: "Tables, deliveries & payments" },
  { id: "stock", label: "Stock, purchases & expenses" },
  { id: "team", label: "Employees & salaries" },
  { id: "reports", label: "Reports & accounts" },
  { id: "website", label: "Website & menu" },
  { id: "owner", label: "Owner setup & system" },
];
const taskIcons: Record<string, string> = {
  pos: "sale",
  orders: "orders",
  kitchen: "kitchen",
  cash: "cash",
  tables: "tables",
  delivery: "delivery",
  inventory: "stock",
  purchases: "stock",
  stockcounts: "stock",
  expenses: "cash",
  staff: "team",
  payroll: "team",
  attendance: "team",
  overview: "reports",
  receivables: "cash",
  approvals: "orders",
  setup: "settings",
};
const labels: Record<string, string> = {
  pos: "New sale",
  orders: "Orders",
  kitchen: "Kitchen",
  cash: "Cash closing",
};
const extraTools: AdminTool[] = [
  {
    id: "workspace",
    href: "/admin/business",
    label: "All business workspaces",
    hint: "Open the complete business workspace and section selector",
    cap: "business",
    group: "owner",
    icon: "reports",
  },
  {
    id: "waiter-desk",
    href: "/admin/table-orders",
    label: "Waiter order desk",
    hint: "Choose an assigned table and send kitchen tickets",
    cap: "table-orders",
    group: "service",
    icon: "tables",
  },
  {
    id: "suppliers",
    href: "/admin/business?section=suppliers",
    label: "Supplier balances",
    hint: "Review supplier dues, advances and payments",
    cap: "purchases",
    group: "stock",
    icon: "stock",
  },
  {
    id: "credit-customers",
    href: "/admin/business?section=customers",
    label: "Credit customers",
    hint: "Manage approved customer credit limits",
    cap: "finance",
    group: "reports",
    icon: "team",
  },
  {
    id: "audit",
    href: "/admin/business?section=audit",
    label: "Change history",
    hint: "Review who changed a record and when",
    cap: "finance",
    group: "reports",
    icon: "reports",
  },
  ...[
    [
      "dashboard",
      "Dashboard",
      "Today's order values and activity",
      "insights",
      "reports",
      "reports",
    ],
    [
      "analytics",
      "Analytics",
      "Order trends and popular items",
      "insights",
      "reports",
      "reports",
    ],
    [
      "insights",
      "Business insights",
      "Detailed operating insights",
      "insights",
      "reports",
      "reports",
    ],
    [
      "products",
      "Products",
      "Menu items, prices and availability",
      "catalog",
      "website",
      "stock",
    ],
    [
      "categories",
      "Categories",
      "Organize the menu",
      "catalog",
      "website",
      "categories",
    ],
    [
      "customers",
      "Customers",
      "Customer accounts and order history",
      "customers",
      "website",
      "team",
    ],
    [
      "coupons",
      "Coupons",
      "Promotional codes and discounts",
      "catalog",
      "website",
      "coupons",
    ],
    [
      "reviews",
      "Reviews",
      "Review customer feedback",
      "catalog",
      "website",
      "reviews",
    ],
    [
      "messages",
      "Messages",
      "Customer contact messages",
      "customers",
      "website",
      "messages",
    ],
    [
      "settings",
      "Settings",
      "Cafe details, fees, opening hours and appearance",
      "settings",
      "website",
      "settings",
    ],
    [
      "experience",
      "Rewards & scheduling",
      "Customer rewards and scheduled orders",
      "admin",
      "website",
      "rewards",
    ],
    [
      "qr-studio",
      "QR menu studio",
      "Prepare table and menu QR codes",
      "catalog",
      "website",
      "qr",
    ],
    [
      "system",
      "System health",
      "Database, backup and background-job status",
      "admin",
      "owner",
      "settings",
    ],
    [
      "demo-data",
      "Demo Data",
      "Preview marked demo-data preparation and cleanup",
      "admin",
      "owner",
      "stock",
    ],
  ].map(([id, label, hint, cap, group, icon]) => ({
    id,
    href: `/admin/${id}`,
    label,
    hint,
    cap,
    group,
    icon,
    ownerOnly: ["system", "demo-data"].includes(id),
  })),
];

/** Navigation reflects current grants; changing the layout never grants permissions. */
export function adminNavigation(user: SessionUser | null | undefined) {
  if (!user || !["ADMIN", "STAFF"].includes(user.role))
    return { primary: [] as AdminTool[], tools: [] as AdminTool[] };
  const ids =
    user.businessProfile === "WAITER"
      ? ["tables", "kitchen", "orders"]
      : user.businessProfile === "CHEF"
        ? ["kitchen", "orders"]
        : ["pos", "orders", "kitchen", "cash"];
  const tasks: AdminTool[] = CAFE_TASKS.map((task) => ({
    ...task,
    icon: taskIcons[task.id] ?? "orders",
    group:
      task.group === "daily"
        ? "service"
        : task.group === "owner"
          ? task.id === "overview"
            ? "reports"
            : task.id === "setup"
              ? "owner"
              : "service"
          : task.group,
  }));
  const primary = ids.flatMap((id) => {
    const task = tasks.find((task) => task.id === id);
    return task && canBusiness(user, task.cap)
      ? [{ ...task, label: labels[id] ?? task.label, group: "daily" }]
      : [];
  });
  const sections: AdminTool[] = BUSINESS_SECTIONS.map((section) => ({
    id: `section-${section.id}`,
    href: `/admin/business?section=${section.id}`,
    label: section.label,
    hint: "Open the existing business workspace",
    cap: section.cap,
    group: ["ledger", "overview"].includes(section.id)
      ? "reports"
      : ["staff", "attendance", "payroll"].includes(section.id)
        ? "team"
        : section.id === "setup"
          ? "owner"
          : ["tables", "delivery", "approvals", "cash"].includes(section.id)
            ? "service"
            : "stock",
    icon: ["ledger", "overview"].includes(section.id) ? "reports" : "stock",
  }));
  const seen = new Set(primary.map((tool) => tool.href));
  const tools = [...tasks, ...sections, ...extraTools].filter((tool) => {
    const allowed =
      tool.cap === "business"
        ? BUSINESS_SECTIONS.some((section) => canBusiness(user, section.cap))
        : canBusiness(user, tool.cap);
    if (
      !allowed ||
      (tool.ownerOnly && user.role !== "ADMIN") ||
      seen.has(tool.href)
    )
      return false;
    seen.add(tool.href);
    return true;
  });
  return { primary, tools };
}
export function adminLinkActive(
  href: string,
  pathname: string,
  section: string | null,
) {
  const [path, query] = href.split("?");
  if (pathname !== path) return false;
  return query
    ? new URLSearchParams(query).get("section") === section
    : !(path === "/admin/business" && section !== null);
}

export function adminToolMatches(
  tool: { id?: string; label: string; hint?: string; group?: string },
  query: string,
) {
  const group =
    TOOL_GROUPS.find((group) => group.id === tool.group)?.label ?? "";
  return `${tool.id ?? ""} ${tool.label} ${tool.hint ?? ""} ${group}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}

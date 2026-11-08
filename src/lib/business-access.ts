export const BUSINESS_PROFILES = [
  "MANAGER",
  "CASHIER",
  "WAITER",
  "CHEF",
] as const;
export type BusinessProfile = (typeof BUSINESS_PROFILES)[number];
const PROFILE_CAPS: Record<BusinessProfile, string[]> = {
  MANAGER: [
    "admin",
    "orders",
    "payments",
    "kitchen",
    "tables",
    "pos",
    "table-orders",
    "catalog",
    "customers",
    "settings",
    "insights",
    "inventory",
    "stock-read",
    "purchases",
    "expenses",
    "attendance",
    "reports",
    "cash",
  ],
  CASHIER: [
    "orders",
    "payments",
    "kitchen",
    "tables",
    "pos",
    "table-orders",
    "cash",
  ],
  WAITER: ["orders", "kitchen", "tables", "table-orders"],
  CHEF: ["orders", "kitchen", "stock-read"],
};
export const BUSINESS_CAPABILITIES = [
  ...new Set(Object.values(PROFILE_CAPS).flat()),
];
export function profileCapabilities(profile?: string | null): string[] {
  return profile && Object.hasOwn(PROFILE_CAPS, profile)
    ? PROFILE_CAPS[profile as BusinessProfile]
    : [];
}
export function canBusiness(
  user:
    | {
        role: string;
        businessProfile?: string | null;
        businessPermissions?: string[] | null;
      }
    | null
    | undefined,
  cap: string,
) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role !== "STAFF") return false;
  const caps = profileCapabilities(user.businessProfile);
  if (!caps.includes(cap)) return false;
  return (
    user.businessPermissions == null || user.businessPermissions.includes(cap)
  );
}
export const BUSINESS_SECTIONS = [
  { id: "overview", label: "Business overview", cap: "reports" },
  { id: "inventory", label: "Ingredients & stock", cap: "stock-read" },
  { id: "recipes", label: "Recipes & costing", cap: "inventory" },
  { id: "procurement", label: "Purchase orders", cap: "purchases" },
  { id: "stockcounts", label: "Physical stock counts", cap: "inventory" },
  { id: "approvals", label: "Approvals", cap: "payments" },
  { id: "purchases", label: "Purchases & suppliers", cap: "purchases" },
  { id: "staff", label: "Team & salaries", cap: "payroll" },
  { id: "attendance", label: "Attendance", cap: "attendance" },
  { id: "payroll", label: "Payroll", cap: "payroll" },
  { id: "cash", label: "Cash shifts", cap: "cash" },
  { id: "expenses", label: "Expenses & money", cap: "expenses" },
  { id: "ledger", label: "Ledger & balances", cap: "finance" },
  { id: "tables", label: "Tables & waiters", cap: "tables" },
  { id: "setup", label: "Opening setup & access", cap: "setup" },
] as const;

/** Restrict waiter order reads to tables assigned to their own employee login. */
export function waiterOrderScope(user: {
  businessProfile?: string | null;
  employeeId?: string | null;
}) {
  return user.businessProfile === "WAITER"
    ? { tableSession: { waiterId: user.employeeId ?? "unassigned" } }
    : {};
}

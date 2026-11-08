export const PERMISSIONS = [
  "dashboard",
  "orders",
  "catalogue",
  "customers",
  "promotions",
  "moderation",
  "settings",
  "pos",
  "inventory",
  "people",
  "shifts",
  "delivery",
  "finance",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export function can(
  user: { role: string; permissions?: string[] } | null | undefined,
  permission: Permission,
) {
  return (
    user?.role === "ADMIN" ||
    (user?.role === "STAFF" && Boolean(user.permissions?.includes(permission)))
  );
}
export const PAGE_PERMISSIONS: Record<string, Permission> = {
  "/admin": "dashboard",
  "/admin/orders": "orders",
  "/admin/products": "catalogue",
  "/admin/categories": "catalogue",
  "/admin/customers": "customers",
  "/admin/coupons": "promotions",
  "/admin/reviews": "moderation",
  "/admin/messages": "moderation",
  "/admin/analytics": "finance",
  "/admin/settings": "settings",
  "/admin/pos": "pos",
  "/admin/inventory": "inventory",
  "/admin/people": "people",
  "/admin/shifts": "shifts",
  "/admin/delivery": "delivery",
  "/admin/finance": "finance",
};

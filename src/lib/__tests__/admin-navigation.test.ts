import test from "node:test";
import assert from "node:assert/strict";
import {
  adminNavigation,
  adminLinkActive,
  adminToolMatches,
} from "../admin-navigation";
import { CAFE_TASKS } from "../cafe-tasks";
import { BUSINESS_SECTIONS, canBusiness } from "../business-access";
import type { SessionUser } from "../types";
const owner: SessionUser = {
  id: "test",
  name: "Test",
  email: "test@example.test",
  role: "ADMIN",
};
test("Owner has four daily actions and all existing business and website tools", () => {
  const nav = adminNavigation(owner),
    all = [...nav.primary, ...nav.tools];
  assert.deepEqual(
    nav.primary.map((t) => t.id),
    ["pos", "orders", "kitchen", "cash"],
  );
  const urls = new Set(all.map((t) => t.href));
  assert.equal(urls.size, all.length);
  for (const task of CAFE_TASKS) assert.ok(urls.has(task.href), task.href);
  for (const section of BUSINESS_SECTIONS)
    assert.ok(urls.has("/admin/business?section=" + section.id));
  for (const route of [
    "dashboard",
    "analytics",
    "insights",
    "products",
    "categories",
    "customers",
    "coupons",
    "reviews",
    "messages",
    "settings",
    "experience",
    "qr-studio",
    "system",
    "demo-data",
  ])
    assert.ok(urls.has("/admin/" + route), route);
});
for (const profile of ["CASHIER", "WAITER", "CHEF", "MANAGER"])
  test(profile + " navigation respects existing grants", () => {
    const user: SessionUser = {
      ...owner,
      role: "STAFF",
      businessProfile: profile,
    };
    const nav = adminNavigation(user);
    for (const tool of [...nav.primary, ...nav.tools]) {
      assert.notEqual(
        tool.ownerOnly,
        true,
        tool.id + " must not expose owner-only tools",
      );
      assert.ok(
        tool.cap === "business" || canBusiness(user, tool.cap),
        tool.id,
      );
    }
    if (profile === "CHEF") assert.equal(nav.primary[0].id, "kitchen");
    if (profile === "WAITER") assert.equal(nav.primary[0].id, "tables");
  });
test("No customer or anonymous admin navigation", () => {
  assert.equal(adminNavigation(null).tools.length, 0);
  assert.equal(
    adminNavigation({ ...owner, role: "CUSTOMER" }).primary.length,
    0,
  );
});
test("Search and current business section preserve direct routes", () => {
  const stock = adminNavigation(owner).tools.find((t) => t.id === "inventory")!;
  assert.ok(adminToolMatches(stock, "INVENTORY"));
  assert.ok(adminToolMatches(stock, "Stock"));
  assert.equal(
    adminLinkActive(stock.href, "/admin/business", "inventory"),
    true,
  );
  assert.equal(adminLinkActive(stock.href, "/admin/business", "cash"), false);
  assert.equal(
    adminLinkActive("/admin/business", "/admin/business", "cash"),
    false,
  );
});

test("A custom cashier mask cannot expose other daily actions or tools", () => {
  const user: SessionUser = {
    ...owner,
    role: "STAFF",
    businessProfile: "CASHIER",
    businessPermissions: ["pos"],
  };
  const nav = adminNavigation(user);
  assert.deepEqual(
    nav.primary.map((t) => t.id),
    ["pos"],
  );
  assert.ok(nav.tools.every((t) => t.cap === "business" || t.cap === "pos"));
});

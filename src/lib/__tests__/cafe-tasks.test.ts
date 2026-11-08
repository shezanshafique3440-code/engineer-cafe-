import { test } from "node:test";
import assert from "node:assert/strict";
import { tasksFor, CAFE_TASKS, TASK_GUIDES } from "../cafe-tasks";
import type { SessionUser } from "../types";
const user = (profile: string, permissions?: string[]): SessionUser => ({
  id: "test",
  name: "Test",
  email: "test@example.test",
  role: "STAFF",
  businessProfile: profile,
  businessPermissions: permissions,
});
test("daily task home follows role grants and starts with the role's main job", () => {
  for (const [profile, first] of [
    ["CASHIER", "pos"],
    ["WAITER", "tables"],
    ["CHEF", "kitchen"],
    ["MANAGER", "overview"],
  ])
    assert.equal(tasksFor(user(profile))[0].id, first);
  assert.ok(
    !tasksFor(user("CASHIER")).some((t) =>
      ["staff", "payroll", "setup", "overview"].includes(t.id),
    ),
  );
  assert.ok(
    !tasksFor(user("CHEF")).some((t) =>
      ["pos", "cash", "delivery"].includes(t.id),
    ),
  );
});
test("per-login restrictions and unassigned logins do not gain shortcuts", () => {
  assert.deepEqual(
    tasksFor(user("CASHIER", ["pos"])).map((t) => t.id),
    ["pos"],
  );
  assert.deepEqual(tasksFor(user("MANAGER", [])), []);
  assert.deepEqual(tasksFor(user("UNKNOWN")), []);
  assert.deepEqual(tasksFor(null), []);
});
test("owner tasks have unique destinations and section guides keep steps short", () => {
  const tasks = tasksFor({ ...user("MANAGER"), role: "ADMIN" });
  assert.equal(tasks.length, CAFE_TASKS.length);
  assert.equal(new Set(tasks.map((t) => t.href)).size, tasks.length);
  for (const guide of Object.values(TASK_GUIDES))
    assert.equal(guide.steps.length, 3);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  paise,
  quantity,
  decimal,
  divideRound,
  issueValue,
  distribute,
  payrollMath,
  businessToday,
  dateValue,
} from "../business-math";
import { canBusiness, waiterOrderScope } from "../business-access";
import { formatCurrency } from "../utils";
test("money and inventory use exact decimal scales, including a single paisa", () => {
  assert.equal(paise("0.01"), 1n);
  assert.equal(paise("999999999999.99"), 99999999999999n);
  assert.equal(decimal(1234567890123n), "12345678901.23");
  assert.equal(quantity("0.0001"), 1n);
  assert.throws(() => paise("1e3"));
  assert.throws(() => paise("0.001"));
  assert.throws(() => quantity("0.00001"));
  assert.equal(divideRound(-5n, 2n), -3n);
});
test("moving average issues conserve the entire recorded cost down to the last paisa", () => {
  let qty = 30000n,
    value = 101n,
    total = 0n;
  for (const used of [10000n, 10000n, 10000n]) {
    const cost = issueValue(qty, value, used);
    qty -= used;
    value -= cost;
    total += cost;
  }
  assert.equal(qty, 0n);
  assert.equal(value, 0n);
  assert.equal(total, 101n);
  assert.throws(() => issueValue(100n, 10n, 101n));
});
test("discount allocation conserves paise and never allocates to a zero-price line", () => {
  assert.deepEqual(distribute(1n, [100n, 100n, 100n]), [1n, 0n, 0n]);
  assert.deepEqual(distribute(5n, [0n, 100n]), [0n, 5n]);
  assert.equal(
    distribute(999n, [1234n, 5678n, 9012n]).reduce((a, b) => a + b, 0n),
    999n,
  );
});
test("payroll separates earned salary, leave, overtime, deductions and advance recovery", () => {
  const result = payrollMath({
    basis: "MONTHLY",
    base: 3000000n,
    days: 30,
    activeDays: 30,
    unpaidHalfDays: 3,
    presentHalfDays: 0,
    overtimeUnits: 25000n,
    overtimeRate: 10000n,
    bonus: 50000n,
    deduction: 10000n,
    advance: 500000n,
  });
  assert.deepEqual(result, {
    base: 3000000n,
    unpaid: 150000n,
    overtime: 25000n,
    earned: 2915000n,
    recovery: 500000n,
    net: 2415000n,
  });
  const daily = payrollMath({
    basis: "DAILY",
    base: 100000n,
    days: 30,
    activeDays: 3,
    unpaidHalfDays: 1,
    presentHalfDays: 5,
    overtimeUnits: 0n,
    overtimeRate: 0n,
    bonus: 0n,
    deduction: 0n,
    advance: 1000000n,
  });
  assert.equal(daily.earned, 250000n);
  assert.equal(daily.recovery, 250000n);
  assert.equal(daily.net, 0n);
});
test("Pakistan business dates and calendar validation stay independent of host timezone", () => {
  assert.equal(businessToday(new Date("2026-11-06T20:30:00Z")), "2026-11-07");
  assert.throws(() => dateValue("2026-02-30"));
  assert.equal(
    dateValue("2026-02-28").toISOString(),
    "2026-02-28T00:00:00.000Z",
  );
});
test("employee role profiles cannot access the owner payroll or ledger", () => {
  for (const profile of ["WAITER", "CHEF", "CASHIER", "MANAGER"]) {
    assert.equal(
      canBusiness({ role: "STAFF", businessProfile: profile }, "payroll"),
      false,
    );
    assert.equal(
      canBusiness({ role: "STAFF", businessProfile: profile }, "finance"),
      false,
    );
  }
  assert.equal(
    canBusiness({ role: "STAFF", businessProfile: "CASHIER" }, "payments"),
    true,
  );
  assert.equal(
    canBusiness({ role: "STAFF", businessProfile: "WAITER" }, "payments"),
    false,
  );
  assert.equal(
    canBusiness({ role: "STAFF", businessProfile: "CHEF" }, "stock-read"),
    true,
  );
  assert.equal(canBusiness({ role: "ADMIN" }, "payroll"), true);
  assert.equal(canBusiness({ role: "CUSTOMER" }, "orders"), false);
});

test("cash change and single-paisa receipts retain their decimals", () => {
  assert.equal(formatCurrency(200.5), "Rs. 200.50");
  assert.equal(formatCurrency(0.01), "Rs. 0.01");
  assert.equal(formatCurrency(150), "Rs. 150");
});

test("waiter order reads use the assigned employee identifier", () => {
  assert.deepEqual(
    waiterOrderScope({ businessProfile: "WAITER", employeeId: "staff-1" }),
    { tableSession: { waiterId: "staff-1" } },
  );
  assert.deepEqual(waiterOrderScope({ businessProfile: "WAITER" }), {
    tableSession: { waiterId: "unassigned" },
  });
  assert.deepEqual(waiterOrderScope({ businessProfile: "CASHIER" }), {});
});

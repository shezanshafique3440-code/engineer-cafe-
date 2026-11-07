import assert from "node:assert/strict";
import { test } from "node:test";
import { businessSlipHtml } from "../business-slip";
test("payroll and closing print statements escape user-provided data", () => {
  const html = businessSlipHtml(
    "Salary <script>alert(1)</script>",
    [
      ["Employee", '<img src=x onerror="alert(1)">'],
      ["Status", "DRAFT & unpaid"],
    ],
    "Not proof of payment",
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("DRAFT &amp; unpaid"));
  assert.ok(html.includes("@page{size:A4"));
  assert.ok(html.includes("Not proof of payment"));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { safeRedirect } from "../safe-redirect";
import { makeCsv } from "../csv";

test("login redirects keep application paths and reject external destinations and login loops", () => {
  assert.equal(safeRedirect("/admin/orders?status=PENDING#latest", "/admin"), "/admin/orders?status=PENDING#latest");
  for (const next of [null, "", "https://example.com", "//example.com", "javascript:alert(1)", "/\\example.com", "/\nexample.com", "/admin/login?next=/admin", "/login", "/register"]) {
    assert.equal(safeRedirect(next, "/admin"), "/admin", String(next));
  }
});

test("CSV export escapes quotes and newlines and neutralizes spreadsheet formulas", () => {
  const csv = makeCsv(["Customer", "Total"], [['A, "quoted" name', 350], ["=HYPERLINK(1)", 200], ["  +SUM(1)", 80], ["line\nbreak", 100]]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"A, ""quoted"" name","350"'));
  assert.ok(csv.includes('"\'=HYPERLINK(1)"'));
  assert.ok(csv.includes('"\'  +SUM(1)"'));
  assert.ok(csv.includes('"line\nbreak","100"'));
});

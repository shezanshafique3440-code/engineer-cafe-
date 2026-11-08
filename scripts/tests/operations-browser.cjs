/** Submit new forms in the disposable local operations fixture. */
const assert = require("node:assert/strict");
const { chromium } = require(
  process.env.CAFE_TEST_PLAYWRIGHT_MODULE || "playwright",
);
const base = process.env.CAFE_BUSINESS_TEST_URL || "http://127.0.0.1:4180";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CAFE_TEST_CHROMIUM || undefined,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    baseURL: base,
    viewport: { width: 390, height: 844 },
  });
  const r = await context.request.post("/api/auth/login", {
    data: {
      email: "business-owner@example.test",
      password: "Business-QA-123!",
    },
  });
  assert.equal(r.status(), 200);
  const authHeaders = { Cookie: r.headers()["set-cookie"].split(";")[0] };
  const api = async (module, body) => {
    const r = await context.request.post("/api/admin/business/" + module, {
      headers: authHeaders,
      data: { ...body, requestId: require("node:crypto").randomUUID() },
    });
    assert.equal(r.status(), 200, await r.text());
    return (await r.json()).result;
  };
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin/business?section=procurement");
  const form = page.locator("form").filter({
    has: page.getByRole("heading", {
      name: "Create purchase order",
      exact: true,
    }),
  });
  await form
    .getByLabel(/^Supplier/)
    .selectOption({ label: "Operations supplier" });
  await form
    .getByLabel(/^Ingredient/)
    .selectOption({ label: "Operations milk · ML" });
  await form.getByLabel(/^Quantity \(stock unit\)/).fill("10");
  await form.getByLabel(/^Line total/).fill("100");
  const note = "Mobile purchase form " + Date.now();
  await form.getByLabel(/^Reason \/ reference/).fill(note);
  await form
    .getByRole("button", { name: "Save purchase order", exact: true })
    .click();
  await page.getByText(note, { exact: true }).waitFor();
  await page.goto("/admin/business?section=stockcounts");
  await page.getByLabel("Counted Operations milk", { exact: true }).fill("9");
  const stockForm = page.locator("form").filter({
    has: page.getByRole("heading", {
      name: "Physical stock count",
      exact: true,
    }),
  });
  const countNote = "Mobile count form " + Date.now();
  await stockForm.getByLabel(/^Reason \/ reference/).fill(countNote);
  await stockForm
    .getByRole("button", { name: "Save count for review", exact: true })
    .click();
  await page
    .getByText("Counted by Cafe Owner · " + countNote, { exact: true })
    .waitFor();
  const cashResponse = await context.request.get("/api/admin/business/cash", {
    headers: authHeaders,
  });
  assert.equal(cashResponse.status(), 200, await cashResponse.text());
  const cash = await cashResponse.json();
  const drawer = cash.drawers.find((d) => d.account.code === "CASH_MAIN");
  const shift = await api("cash", {
    action: "OPEN",
    drawerId: drawer.id,
    amount: drawer.balance,
    note: "Mobile denomination form check",
  });
  try {
    await page.goto("/admin/business?section=cash");
    await page
      .getByRole("button", { name: "Count & close shift", exact: true })
      .click();
    await page
      .getByLabel(
        "Maine pending kaam aur doosre devices ke bills check kar liye hain",
        { exact: true },
      )
      .check();
    await page
      .getByRole("button", { name: "Agla step: Cash ginein", exact: true })
      .click();
    await page.getByLabel(/^Count method/).selectOption("notes");
    await page.getByLabel("Rs. 100 · pieces", { exact: true }).fill("2");
    await page.getByText(/Physical total: Rs\. 200\.00/).waitFor();
    await page.getByLabel(/^Count method/).selectOption("manual");
    await page.getByLabel(/^Actual cash counted/).fill(drawer.balance);
    const closeForm = page.locator("form").filter({
      has: page.getByRole("heading", {
        name: "Close cash shift",
        exact: true,
      }),
    });
    await closeForm
      .getByLabel(/^Reason \/ reference/)
      .fill("Mobile count matches actual drawer");
    await closeForm
      .getByRole("button", { name: "Record count & close", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Close cash shift", exact: true })
      .waitFor({ state: "hidden" });
  } finally {
    const now = await (
      await context.request.get("/api/admin/business/cash", {
        headers: authHeaders,
      })
    ).json();
    if (now.drawers.some((d) => d.activeShift?.id === shift.id))
      await api("cash", {
        action: "CLOSE",
        shiftId: shift.id,
        amount: drawer.balance,
        note: "Close isolated UI fixture",
      });
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS mobile purchase order submission, physical count draft, denomination calculation and matching-cash closing.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

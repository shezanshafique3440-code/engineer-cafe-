/** Mobile and role regression for the isolated business fixture only. */
const baseURL = process.env.CAFE_BUSINESS_TEST_URL || "http://localhost:4175";
if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname))
  throw Error("Local test server required");
const { chromium } = require(
  process.env.CAFE_TEST_PLAYWRIGHT_MODULE || "playwright",
);
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CAFE_TEST_CHROMIUM || undefined,
    args: ["--no-sandbox"],
  });
  const errors = [];
  const artifacts =
    process.env.CAFE_TEST_ARTIFACTS || "/tmp/cafe-business-browser";
  fs.mkdirSync(artifacts, { recursive: true });
  const context = await browser.newContext({
    baseURL: baseURL,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin/login");
  await page.getByLabel(/^Email/).fill("business-owner@example.test");
  await page.getByLabel(/^Password/).fill("Business-QA-123!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(
    (u) => u.pathname === "/admin" || u.pathname === "/admin/business",
    { timeout: 60000 },
  );
  const sections = [
    "overview",
    "inventory",
    "recipes",
    "purchases",
    "procurement",
    "stockcounts",
    "approvals",
    "staff",
    "attendance",
    "payroll",
    "cash",
    "expenses",
    "ledger",
    "tables",
    "setup",
    "suppliers",
    "customers",
    "receivables",
    "audit",
  ];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const section of sections) {
      await page.goto("/admin/business?section=" + section);
      await page.getByLabel("Workspace", { exact: true }).waitFor();
      await page.waitForFunction(
        () =>
          !document.body.innerText.includes("Loading workspace") &&
          document.querySelectorAll('table,form,[role="alert"]').length > 0,
      );
      await page.waitForTimeout(200);
      const alerts = await page
        .getByText("Workspace could not load", { exact: true })
        .count();
      assert.equal(alerts, 0, section + " data failed");
      const size = await page.evaluate(() => ({
        view: innerWidth,
        body: document.documentElement.scrollWidth,
      }));
      assert.ok(
        size.body <= size.view + 2,
        `${section} overflow at ${width}: ${JSON.stringify(size)}`,
      );
      if (
        width === 390 &&
        [
          "overview",
          "inventory",
          "payroll",
          "tables",
          "procurement",
          "cash",
          "approvals",
        ].includes(section)
      )
        await page.screenshot({
          path: artifacts + "/" + section + "-mobile.png",
          fullPage: true,
        });
    }
    console.log("PASS all business panels at width", width);
  }
  await page.goto("/admin/business?section=attendance");
  await page.getByLabel("Actual clock-in (Pakistan time)").waitFor();
  // Exercise the shared form through the browser, rather than only its API.
  await page.goto("/admin/business?section=suppliers");
  const supplierName = "Browser supplier " + Date.now();
  await page.getByLabel(/^Name/).fill(supplierName);
  const save = page.getByRole("button", { name: "Save", exact: true });
  await save.click();
  await page
    .locator("td")
    .getByText(supplierName, { exact: true })
    .first()
    .waitFor();
  await page.goto("/");
  await page.waitForFunction(
    () => document.querySelectorAll(".classic-hero").length === 1,
  );
  await page.locator(".classic-hero").waitFor();
  const heading = await page.locator(".classic-hero h1").innerText();
  assert.match(heading, /Chai/);
  assert.match(heading, /Engineering/);
  assert.equal(await page.locator(".cinema-hero").count(), 0);
  await page.locator(".classic-hero img").first().waitFor();
  await page.screenshot({
    path: artifacts + "/classic-hero-mobile.png",
    fullPage: false,
  });
  for (const [email, target] of [
    ["chef@example.test", "inventory"],
    ["waiter@example.test", "tables"],
    ["cashier@example.test", "cash"],
  ]) {
    const c = await browser.newContext({
      baseURL: baseURL,
      viewport: { width: 390, height: 844 },
    });
    const login = await c.request.post("/api/auth/login", {
      data: { email, password: "Business-QA-123!" },
    });
    assert.equal(login.status(), 200);
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("/admin/business?section=" + target);
    await p.getByLabel("Workspace", { exact: true }).waitFor();
    const available = await p
      .getByLabel("Workspace", { exact: true })
      .locator("option")
      .allTextContents();
    assert.equal(available.includes("Payroll"), false);
    assert.equal(available.includes("Ledger & balances"), false);
    assert.equal(available.includes("Team & salaries"), false);
    if (email.startsWith("chef")) {
      assert.equal(
        await p
          .getByRole("button", { name: "Save ingredient", exact: true })
          .count(),
        0,
      );
      await p.goto("/admin/kitchen");
      await p
        .getByRole("heading", { name: "Kitchen live", exact: true })
        .waitFor();
    }
    await c.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS original hero, mobile forms, profile-specific navigation and zero browser exceptions",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

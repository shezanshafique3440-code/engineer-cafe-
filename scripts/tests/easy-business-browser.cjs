/** Client scenarios on the explicit disposable database: real forms, exact stock units and money. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { randomUUID } = require("node:crypto");
const { chromium } = require("playwright"),
  { PrismaClient } = require("@prisma/client");
const base = process.env.CAFE_BUSINESS_TEST_URL;
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
assert.equal(
  new URL(process.env.DATABASE_URL).pathname,
  "/cafe_operations_test",
);
const db = new PrismaClient(),
  out = process.env.CAFE_TEST_ARTIFACTS || "/tmp/cafe-easy-business";
fs.mkdirSync(out, { recursive: true });
let browser,
  lastPage,
  checks = 0;
const eq = (a, b, label) => {
  assert.deepEqual(a, b, label);
  checks++;
};
const field = (root, label) =>
  root.getByLabel(
    new RegExp(
      "^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\*?\\s*$",
    ),
  );
const form = (page, title) =>
  page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
async function postForm(page, f, button, module) {
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/business/" + module) &&
      r.request().method() === "POST",
  );
  await f.getByRole("button", { name: button, exact: true }).click();
  const r = await response;
  eq(r.status(), 200, await r.text());
  return (await r.json()).result;
}
async function poll(fn, message) {
  for (let i = 0; i < 100; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw Error(message);
}
(async () => {
  try {
    browser = await chromium.launch({
      executablePath: process.env.CAFE_TEST_CHROMIUM,
      headless: true,
      args: ["--no-sandbox"],
    });
    const c = await browser.newContext({
      baseURL: base,
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: { "X-Real-IP": "192.0.2.207" },
    });
    c.setDefaultTimeout(10000);
    const auth = await c.request.post("/api/auth/login", {
      data: {
        email: "business-owner@example.test",
        password: "Business-QA-123!",
      },
    });
    eq(auth.status(), 200);
    const headers = { Cookie: auth.headers()["set-cookie"].split(";")[0] };
    const context = await (
      await c.request.get("/api/admin/sales-context", { headers })
    ).json();
    const account =
      context.accounts.find((a) => a.code === "BANK") ||
      context.accounts.find((a) => !a.drawer && a.code !== "RIDER_CASH");
    assert.ok(account);
    checks++;
    const p = await c.newPage(),
      errors = [];
    lastPage = p;
    p.on("pageerror", (e) => errors.push(e.message));
    const suffix = randomUUID().slice(0, 8),
      supplierName = "UX Local supplier " + suffix,
      flourName = "UX Flour " + suffix,
      invoice = "UX-INV-" + suffix;
    await p.goto("/admin/business?section=suppliers");
    let f = form(p, "Add supplier");
    await field(f, "Name").fill(supplierName);
    await field(f, "Phone").fill("03001234567");
    eq(
      await field(f, "Email").isVisible(),
      false,
      "Optional supplier email is tucked away",
    );
    const supplier = await postForm(p, f, "Save", "suppliers");
    await p.goto("/admin/business?section=inventory");
    await p
      .getByRole("button", { name: "Add ingredient", exact: true })
      .click();
    f = form(p, "Add ingredient");
    await field(f, "Ingredient").fill(flourName);
    await field(f, "How is it measured?").selectOption("G");
    await field(f, "Low-stock alert quantity").fill("2");
    await p.screenshot({
      path: path.join(out, "01-add-ingredient-desktop.png"),
      fullPage: true,
    });
    await f.screenshot({path:path.join(out,"01-add-ingredient-desktop-form.png")});
    const ingredient = await postForm(p, f, "Save ingredient", "ingredients");
    eq(String(ingredient.reorderAt), "2000", "2 kg alert is stored as 2000 g");
    eq(ingredient.unit, "G");
    eq(
      String(ingredient.quantity),
      "0",
      "Creating an ingredient does not invent stock",
    );
    await field(p, "Find an ingredient").fill(flourName);
    const card = p
      .getByLabel("Available stock", { exact: true })
      .locator("article")
      .filter({
        has: p.getByRole("heading", { name: flourName, exact: true }),
      });
    await card
      .getByRole("button", { name: "Edit ingredient", exact: true })
      .click();
    eq(
      await field(
        form(p, "Edit ingredient"),
        "How is it measured?",
      ).isDisabled(),
      true,
      "Existing stock measure stays fixed",
    );
    await p.goto("/admin/business?section=purchases");
    f = form(p, "Receive supplier invoice");
    eq(
      await field(p, "From").isVisible(),
      false,
      "Daily input is above optional history filters",
    );
    await field(f, "Supplier").selectOption(supplier.id);
    await field(f, "Supplier invoice number").fill(invoice);
    await field(f, "Ingredient").selectOption(ingredient.id);
    await field(f, "Quantity").fill("2.5");
    await field(f, "Line total (Rs.)").fill("1250");
    await field(f, "Paid now (Rs.)").fill("500");
    await field(f, "Paid from").selectOption(account.id);
    await f
      .getByRole("region", { name: "Invoice totals" })
      .getByText("Rs. 750.00", { exact: true })
      .waitFor();
    checks++;
    await p.screenshot({
      path: path.join(out, "02-purchase-simple-desktop.png"),
      fullPage: true,
    });
    await f.screenshot({path:path.join(out,"02-purchase-simple-desktop-form.png")});
    await f
      .getByRole("button", {
        name: "Post invoice & receive stock",
        exact: true,
      })
      .click();
    await f
      .getByRole("heading", { name: "Review before saving", exact: true })
      .waitFor();
    eq(
      await db.businessPurchase.count({ where: { invoiceNumber: invoice } }),
      0,
      "Review does not post the invoice",
    );
    eq(
      String(
        (await db.ingredient.findUnique({ where: { id: ingredient.id } }))
          .quantity,
      ),
      "0",
    );
    await p.screenshot({
      path: path.join(out, "03-purchase-review-desktop.png"),
      fullPage: true,
    });
    await f.getByRole("button", { name: "Back to edit", exact: true }).click();
    await field(f, "Unit for Quantity").selectOption("G");
    eq(
      await field(f, "Quantity").inputValue(),
      "2500",
      "Switching kg to grams keeps the amount",
    );
    await field(f, "Unit for Quantity").selectOption("KG");
    eq(await field(f, "Quantity").inputValue(), "2.5");
    await f
      .getByRole("button", {
        name: "Post invoice & receive stock",
        exact: true,
      })
      .click();
    const received = await postForm(p, f, "Confirm & save", "purchases");
    assert.ok(received);
    checks++;
    const stock = await db.ingredient.findUnique({
      where: { id: ingredient.id },
    });
    eq(String(stock.quantity), "2500");
    eq(String(stock.stockValue), "1250");
    eq(
      await db.businessPurchase.count({ where: { invoiceNumber: invoice } }),
      1,
    );
    const suppliers = await (
      await c.request.get("/api/admin/business/suppliers", { headers })
    ).json();
    eq(
      suppliers.parties.find((a) => a.id === supplier.id).balance,
      "750.00",
      "Supplier due is invoice less actual payment",
    );
    const category = await db.category.findFirst({ where: { isActive: true } });
    const product = await db.product.create({
      data: {
        name: "UX Roti " + suffix,
        slug: "ux-roti-" + suffix,
        description: "Disposable recipe UI fixture",
        price: 100,
        categoryId: category.id,
      },
    });
    await p.goto("/admin/business?section=recipes");
    await field(p, "Choose item").selectOption(product.id);
    f = p
      .locator("form")
      .filter({
        has: p.getByRole("heading", {
          name: "Recipe · " + product.name,
          exact: true,
        }),
      });
    await field(f, "Portions made by this batch").fill("10");
    await field(f, "Ingredient").selectOption(ingredient.id);
    await field(f, "Unit for Quantity").selectOption("KG");
    await field(f, "Quantity").fill("1");
    await f.getByRole("button", { name: "Save recipe", exact: true }).click();
    await f.getByText(/For one sale: 100 g/).waitFor();
    checks++;
    await p.screenshot({
      path: path.join(out, "04-recipe-review-desktop.png"),
      fullPage: true,
    });
    await postForm(p, f, "Confirm & save", "recipes");
    const recipe = await db.recipe.findUnique({
      where: { productId: product.id },
      include: { lines: true },
    });
    eq(String(recipe.yieldUnits), "10");
    eq(String(recipe.lines[0].quantity), "1000");
    // Non-food services retain the existing no-ingredients path.
    const service = await db.product.create({
      data: {
        name: "UX Packing " + suffix,
        slug: "ux-packing-" + suffix,
        description: "Disposable non-food fixture",
        price: 20,
        categoryId: category.id,
        recipeRequired: false,
      },
    });
    await p.reload();
    await field(p, "Choose item").selectOption(service.id);
    f = p
      .locator("form")
      .filter({
        has: p.getByRole("heading", {
          name: "Recipe · " + service.name,
          exact: true,
        }),
      });
    await f.getByRole("button", { name: "Save recipe", exact: true }).click();
    await postForm(p, f, "Confirm & save", "recipes");
    eq(
      (
        await db.recipe.findUnique({
          where: { productId: service.id },
          include: { lines: true },
        })
      ).lines.length,
      0,
      "Non-food service can keep no ingredient lines",
    );
    await p.goto("/admin/business?section=stockcounts");
    f = form(p, "Physical stock count");
    await field(f, "Counted " + flourName).fill("2");
    await field(f, "Reason / reference").fill("Client UI count " + suffix);
    const response = p.waitForResponse(
      (r) =>
        r.url().endsWith("/api/admin/business/stockcounts") &&
        r.request().method() === "POST",
    );
    await f
      .getByRole("button", { name: "Save count for review", exact: true })
      .click();
    const counted = await response;
    eq(counted.status(), 200, await counted.text());
    eq(
      counted
        .request()
        .postDataJSON()
        .lines.find((l) => l.ingredientId === ingredient.id).counted,
      "2000",
    );
    eq(
      String(
        (await db.ingredient.findUnique({ where: { id: ingredient.id } }))
          .quantity,
      ),
      "2500",
      "A draft count does not change stock",
    );
    await p.goto("/admin/business?section=expenses");
    f = form(p, "Record expense / money movement");
    await field(f, "Amount (Rs.)").fill("80");
    await field(f, "Money account").selectOption(account.id);
    await field(f, "Expense category").selectOption("GAS");
    const note = "Client gas bill " + suffix;
    await field(f, "Reason / reference").fill(note);
    await f
      .getByRole("button", { name: "Post transaction", exact: true })
      .click();
    eq(await db.businessJournal.count({ where: { note } }), 0);
    await postForm(p, f, "Confirm & save", "money");
    eq(await db.businessJournal.count({ where: { note } }), 1);
    await field(f, "Amount (Rs.)").waitFor();
    eq(
      await field(f, "Amount (Rs.)").inputValue(),
      "",
      "Successful entry resets rather than offering the same payment again",
    );
    await p.goto("/admin/business?section=staff");
    f = form(p, "Add employee");
    const employeeName = "UX Helper " + suffix;
    await field(f, "Full name").fill(employeeName);
    await field(f, "Job / designation").fill("Helper");
    await field(f, "Contract pay (Rs.)").fill("35000");
    eq(await field(f, "Create a staff login").isVisible(), false);
    await p.screenshot({
      path: path.join(out, "05-employee-simple-desktop.png"),
      fullPage: true,
    });
    await f.screenshot({path:path.join(out,"05-employee-simple-desktop-form.png")});
    await postForm(p, f, "Save employee", "staff");
    const employee = await db.employee.findFirst({
      where: { party: { name: employeeName } },
      include: { access: true },
    });
    assert.match(employee.code, /^EMP-/);
    checks++;
    eq(employee.access, null, "Employee records do not force staff logins");
    eq(String(employee.basePay), "35000");
    await p.goto("/admin/business?section=attendance");
    const attendanceCard = p
      .locator("article")
      .filter({
        has: p.getByRole("heading", { name: employeeName, exact: true }),
      });
    await attendanceCard
      .getByRole("button", { name: "Present", exact: true })
      .click();
    await attendanceCard.getByText("PRESENT", { exact: true }).waitFor();
    eq(await db.attendance.count({ where: { employeeId: employee.id } }), 1);
    await p.goto("/admin/business?section=delivery");
    await p
      .getByRole("button", { name: "Add / edit rider", exact: true })
      .click();
    f = form(p, "Add rider");
    const riderName = "UX Rider " + suffix;
    await field(f, "Rider name").fill(riderName);
    await field(f, "Phone").fill("03001234567");
    await postForm(p, f, "Save", "delivery");
    const rider = await db.deliveryRider.findFirst({
      where: { party: { name: riderName } },
    });
    assert.match(rider.code, /^R-/);
    checks++;
    for (const width of [320, 390, 768, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      for (const section of [
        "inventory",
        "purchases",
        "recipes",
        "staff",
        "expenses",
        "delivery",
      ]) {
        await p.goto("/admin/business?section=" + section);
        await field(p, "Switch task").waitFor();
        await p.waitForFunction(() =>
          Boolean(
            document.querySelector(
              'main form,main [aria-label="Available stock"]',
            ),
          ),
        );
        eq(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
          true,
          section + " fits " + width,
        );
      }
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/admin/business?section=inventory");
    await p
      .getByRole("button", { name: "Add ingredient", exact: true })
      .click();
    await p.screenshot({
      path: path.join(out, "06-ingredient-mobile.png"),
      fullPage: true,
    });
    await p.goto("/admin/business?section=purchases");
    f = form(p, "Receive supplier invoice");
    await field(f, "Ingredient").selectOption(ingredient.id);
    await field(f, "Quantity").fill("2");
    await field(f, "Line total (Rs.)").fill("1000");
    await p.screenshot({
      path: path.join(out, "07-purchase-mobile.png"),
      fullPage: true,
    });
    eq(errors, [], "No runtime errors across the client scenarios");
    console.log(
      `PASS: ${checks} client input scenarios: ingredient, exact kg/L units, invoice/payment review, recipes including non-food service, stock count, expenses, employees without login, attendance, rider codes and four responsive widths.`,
    );
    await c.close();
  } catch (error) {
    if (lastPage) {
      console.error(
        "UI_DIAGNOSTIC",
        lastPage.url(),
        (await lastPage.locator("body").innerText()).slice(0, 6500),
      );
      await lastPage.screenshot({
        path: path.join(out, "failed-scenario.png"),
        fullPage: true,
      });
    }
    throw error;
  } finally {
    await browser?.close();
    await db.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

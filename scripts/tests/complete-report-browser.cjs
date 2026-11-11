const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");
const { chromium } = require(
  process.env.CAFE_TEST_PLAYWRIGHT_MODULE || "playwright",
);
const ExcelJS = require("exceljs");
const base = process.env.CAFE_REPORT_TEST_URL || "http://127.0.0.1:4193";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const dbUrl = new URL(process.env.DATABASE_URL);
assert.ok(["127.0.0.1", "localhost"].includes(dbUrl.hostname));
assert.ok(
  ["/cafe_demo_cleanup_test", "/cafe_operations_test"].includes(dbUrl.pathname),
);
const db = new PrismaClient();
let browser,
  checks = 0;
async function session(context, user) {
  const { SignJWT } = await import("jose");
  const token = await new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setSubject(user.id)
    .setIssuer("engineer-cafe")
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  await context.addCookies([{ name: "ec_session", value: token, url: base }]);
}
(async () => {
  try {
    const owner = await db.user.findFirstOrThrow({
      where: { role: "ADMIN", isActive: true },
    });
    browser = await chromium.launch({
      executablePath: process.env.CAFE_TEST_CHROMIUM,
      headless: true,
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      acceptDownloads: true,
    });
    await session(context, owner);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/admin/business?section=overview");
    const button = page.getByRole("button", {
      name: "Download Excel",
      exact: true,
    });
    await button.waitFor();
    checks++;
    await page.getByLabel("From", { exact: true }).fill("2001-01-01");
    await page.getByLabel("To", { exact: true }).fill("2001-01-01");
    await page.getByLabel("Report", { exact: true }).selectOption("riders");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      button.click(),
    ]);
    assert.equal(
      download.suggestedFilename(),
      "Riders-2001-01-01-to-2001-01-01.xlsx",
    );
    checks++;
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(await download.path());
    assert.ok(book.getWorksheet("Summary"));
    assert.ok(book.getWorksheet("Rider commissions"));
    checks += 2;
    await page
      .getByRole("status")
      .filter({
        hasText: "Riders & deliveries downloaded for 2001-01-01 to 2001-01-01.",
      })
      .waitFor();
    checks++;
    const [zipDownload] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: "Download All (ZIP)", exact: true })
        .click(),
    ]);
    assert.equal(
      zipDownload.suggestedFilename(),
      "Cafe-All-Reports-2001-01-01-to-2001-01-01.zip",
    );
    checks++;
    const { createRequire } = require("node:module");
    const JSZip = createRequire(require.resolve("exceljs"))("jszip");
    const zip = await JSZip.loadAsync(
      fs.readFileSync(await zipDownload.path()),
      { checkCRC32: true },
    );
    assert.equal(Object.keys(zip.files).length, 9);
    checks++;
    await page.getByLabel("From", { exact: true }).fill("2001-01-02");
    assert.equal(await button.isDisabled(), true);
    checks++;
    await page.getByLabel("From", { exact: true }).fill("2001-01-01");
    await page.route("**/api/admin/complete-report?*", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error:
            "Another complete report is being prepared. Please retry shortly.",
        }),
      }),
    );
    await button.click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Another complete report" })
      .waitFor();
    checks++;
    await page.unroute("**/api/admin/complete-report?*");
    const folder =
      process.env.CAFE_REPORT_ARTIFACTS ||
      "/workspace/artifacts/complete-report";
    fs.mkdirSync(folder, { recursive: true });
    await page.screenshot({
      path: folder + "/report-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "Mobile layout fits viewport",
    );
    checks++;
    assert.deepEqual(errors, []);
    checks++;
    const staff = await db.user.findFirstOrThrow({
      where: { role: "STAFF", email: { startsWith: "report-test-" } },
    });
    await db.staffAccess.upsert({
      where: { userId: staff.id },
      create: { userId: staff.id, profile: "MANAGER" },
      update: { profile: "MANAGER" },
    });
    await session(context, staff);
    await page.goto(base + "/admin/business?section=overview");
    await page
      .getByRole("heading", { name: "Business overview", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Download Excel", exact: true })
        .count(),
      0,
    );
    checks++;
    console.log(
      `PASS: ${checks} complete-report browser checks (owner download, real workbook, dates, errors, mobile and manager visibility).`,
    );
  } finally {
    await browser?.close();
    await db.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

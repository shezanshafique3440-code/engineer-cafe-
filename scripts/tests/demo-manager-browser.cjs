const assert = require("node:assert/strict"),
  fs = require("node:fs");
const u = new URL(process.env.DATABASE_URL || "http://invalid");
if (
  !["localhost", "127.0.0.1"].includes(u.hostname) ||
  u.pathname != "/cafe_demo_cleanup_test"
)
  throw Error("Disposable local demo database required.");
const root = process.env.CAFE_DEMO_TEST_URL || "http://127.0.0.1:4185";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(root))
  throw Error("Local test server required.");
const { chromium } = require(
  process.env.CAFE_TEST_PLAYWRIGHT_MODULE || "playwright",
);
(async () => {
  const { SignJWT } = await import("jose");
  let checks = 0;
  const sign = (id, role) =>
    new SignJWT({
      name: "Demo QA",
      email: role === "ADMIN" ? "owner@example.test" : "staff@example.test",
      role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(id)
      .setIssuer("engineer-cafe")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  const owner = await sign("demo-qa-owner", "ADMIN"),
    staff = await sign("demo-qa-staff", "STAFF");
  const call = (path, token, body, origin) =>
    fetch(root + path, {
      headers: {
        ...(token ? { cookie: "ec_session=" + token } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(origin ? { origin } : {}),
      },
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    });
  assert.equal((await call("/api/admin/demo-data")).status, 401);
  checks++;
  assert.equal((await call("/api/admin/demo-data", staff)).status, 403);
  checks++;
  assert.equal(
    (
      await call("/api/admin/demo-data", staff, {
        action: "SEED",
        confirmation: "LOAD DEMO DATA",
      })
    ).status,
    403,
  );
  checks++;
  assert.equal(
    (
      await call(
        "/api/admin/demo-data",
        owner,
        { action: "SEED", confirmation: "LOAD DEMO DATA" },
        "https://other.example",
      )
    ).status,
    403,
  );
  checks++;
  assert.equal(
    (
      await call("/api/admin/demo-data", owner, {
        action: "CLEANUP",
        confirmation: "yes",
      })
    ).status,
    422,
  );
  checks++;
  const response = await call("/api/admin/demo-data", owner);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  checks += 2;
  const text = await response.text();
  assert.ok(!/backupPath|backupHash|passwordHash|DATABASE_URL/.test(text));
  checks++;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CAFE_TEST_CHROMIUM || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
    });
    await context.addCookies([{ name: "ec_session", value: owner, url: root }]);
    const page = await context.newPage();
    await page.goto(root + "/admin/demo-data");
    await page
      .getByRole("heading", { name: "Demo Data", exact: true })
      .waitFor();
    await page.getByRole("heading", { name: "Recent jobs" }).waitFor();
    checks += 2;
    assert.ok(
      (await page
        .getByRole("link", { name: "Demo Data", exact: true })
        .count()) > 0,
    );
    checks++;
    if (
      await page.getByRole("button", { name: "Preview cleanup" }).isEnabled()
    ) {
      await page.getByRole("button", { name: "Preview cleanup" }).click();
      await page
        .getByText(/proven demo records to remove/)
        .waitFor({ timeout: 90000 });
      checks++;
    }
    const out = process.env.CAFE_TEST_ARTIFACTS || "/tmp/demo-manager-browser";
    fs.mkdirSync(out, { recursive: true });
    await page.screenshot({
      path: out + "/demo-data-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
    );
    checks++;
    await page.screenshot({
      path: out + "/demo-data-mobile.png",
      fullPage: true,
    });
    await context.close();
    const restricted = await browser.newContext();
    await restricted.addCookies([
      { name: "ec_session", value: staff, url: root },
    ]);
    const staffPage = await restricted.newPage();
    await staffPage.goto(root + "/admin/demo-data");
    await staffPage.waitForURL(url => url.pathname !== "/admin/demo-data", {timeout:15000});
    assert.ok(!staffPage.url().endsWith("/admin/demo-data"));
    checks++;
    await restricted.close();
  } finally {
    await browser.close();
  }
  console.log(
    `PASS: ${checks} owner-only API, confirmation, privacy and responsive UI checks.`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

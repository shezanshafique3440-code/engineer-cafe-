/** Login and non-mutating business checks; credentials stay on this VPS and are never logged. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const base = process.env.CAFE_VERIFY_URL || "http://127.0.0.1:3100";
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Use the local VPS app",
);
const file =
  process.env.CAFE_VERIFY_LOGINS ||
  "/var/backups/engineer-cafe/practice-latest/practice-logins.txt";
(async () => {
  let ready = false;
  for (let i = 0; i < 10; i++) {
    try {
      if ((await fetch(base + "/admin/login")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.ok(ready, "App login route did not become ready");
  const logins = [
    ...fs
      .readFileSync(file, "utf8")
      .matchAll(
        /(MANAGER|CASHIER|WAITER|CHEF)\nEmail: ([^\n]+)\nPassword: ([^\n]+)/g,
      ),
  ];
  assert.equal(logins.length, 4, "Expected four private practice logins");
  let checks = 1;
  for (const [, profile, email, password] of logins) {
    const r = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(r.status, 200, profile + " login failed");
    const cookie = r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
    checks++;
    for (const route of ["payroll", "ledger", "setup"]) {
      const denied = await fetch(base + "/api/admin/business/" + route, {
        headers: { Cookie: cookie },
      });
      assert.equal(
        denied.status,
        403,
        profile + " owner-only permission check failed",
      );
      checks++;
    }
    const allowed = await fetch(base + "/api/admin/kitchen", {
      headers: { Cookie: cookie },
    });
    assert.equal(allowed.status, 200, profile + " kitchen access failed");
    checks++;
    if (profile === "CASHIER") {
      const context = await (
        await fetch(base + "/api/admin/sales-context", {
          headers: { Cookie: cookie },
        })
      ).json();
      assert.equal(context.enabled, true, "Accounting is not activated");
      assert.ok(context.shift, "Practice cashier has no active shift");
      checks += 2;
    }
    console.log("PASS " + profile + " login and permission checks");
  }
  console.log(
    `PASS ${checks} login/readiness checks. No orders, receipts, refunds or messages were created.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

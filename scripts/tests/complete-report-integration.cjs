/** Real XLSX/HTTP integration; explicitly disposable localhost DB only. */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const ExcelJS = require("exceljs");
const base = process.env.CAFE_REPORT_TEST_URL || "http://127.0.0.1:4193";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const url = new URL(process.env.DATABASE_URL);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
assert.ok(
  ["/cafe_demo_cleanup_test", "/cafe_operations_test"].includes(url.pathname),
);
const db = new PrismaClient();
const tag = "report-test-" + randomUUID();
let checks = 0;
function eq(a, b, message) {
  assert.deepEqual(a, b, message);
  checks++;
}
async function cookie(id, role) {
  const { SignJWT } = await import("jose");
  const identity = await db.user.findUniqueOrThrow({
    where: { id },
    select: { email: true, name: true },
  });
  const token = await new SignJWT({ ...identity, role })
    .setSubject(id)
    .setIssuer("engineer-cafe")
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  return "ec_session=" + token;
}
async function request(query, auth) {
  return fetch(base + "/api/admin/complete-report" + query, {
    headers: auth ? { Cookie: auth } : {},
  });
}
function objects(book, name) {
  const sheet = book.getWorksheet(name);
  assert.ok(sheet, name);
  const headers = sheet.getRow(1).values;
  const rows = [];
  sheet.eachRow((row, number) => {
    if (number > 1)
      rows.push(
        Object.fromEntries(
          headers.slice(1).map((key, i) => [key, row.getCell(i + 1).value]),
        ),
      );
  });
  return rows;
}
(async () => {
  try {
    const admin = await db.user.findFirstOrThrow({
      where: { role: "ADMIN", isActive: true },
    });
    const staff = await db.user.create({
      data: {
        name: "Export test staff",
        email: tag + "@example.test",
        passwordHash: "DO-NOT-EXPORT-THIS-HASH",
        role: "STAFF",
      },
    });
    const ownerCookie = await cookie(admin.id, "ADMIN"),
      staffCookie = await cookie(staff.id, "STAFF");
    eq((await request("", null)).status, 401);
    eq(
      (await request("?from=2001-01-01&to=2001-01-01", staffCookie)).status,
      403,
    );
    for (const query of [
      "",
      "?from=2001-02-30&to=2001-03-01",
      "?from=2001-01-02&to=2001-01-01",
      "?from=2001-01-01&to=2020-01-01",
    ])
      eq((await request(query, ownerCookie)).status, 400);
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('cafe.business_session','1',true)`;
      const times = [
        "2000-12-31T18:59:59Z",
        "2000-12-31T19:00:00Z",
        "2001-01-01T18:59:59Z",
        "2001-01-01T19:00:00Z",
      ];
      for (let i = 0; i < 234; i++)
        await tx.order.create({
          data: {
            id: tag + "-" + i,
            orderNumber: tag + "-" + i,
            customerName:
              i === 1 ? '=HYPERLINK("https://example.test")' : "Test customer",
            customerPhone: "+920000000",
            createdAt: new Date(times[i < 4 ? i : 1]),
            subtotal: 100,
            total: 100,
            status: "CANCELLED",
            items: {
              create: {
                productName: "Historical test chai",
                productSlug: "test",
                unitPrice: 100,
                quantity: 1,
                lineTotal: 100,
              },
            },
          },
        });
      const accounts = {};
      for (const [kind, code, money] of [
        ["ASSET", "cash", true],
        ["INCOME", "income", false],
        ["EXPENSE", "expense", false],
        ["EQUITY", "capital", false],
      ])
        accounts[code] = await tx.businessAccount.create({
          data: { code: tag + code, name: tag + code, kind, isMoney: money },
        });
      for (const [label, date, amount, debit, credit] of [
        ["opening", "2000-12-31", 1000, "cash", "capital"],
        ["sale", "2001-01-01", 500, "cash", "income"],
        ["expense", "2001-01-01", 100, "expense", "cash"],
      ])
        await tx.businessJournal.create({
          data: {
            eventKey: tag + label,
            source: "REPORT_TEST",
            sourceId: tag,
            date: new Date(date + "T00:00:00Z"),
            note: "Export fixture",
            actorId: admin.id,
            actorName: admin.name,
            postings: {
              create: [
                { accountId: accounts[debit].id, debit: amount },
                { accountId: accounts[credit].id, credit: amount },
              ],
            },
          },
        });
    });
    const countBefore = await db.businessJournal.count();
    const response = await request(
      "?from=2001-01-01&to=2001-01-01",
      ownerCookie,
    );
    eq(
      response.status,
      200,
      await response
        .clone()
        .text()
        .then((t) => (t.startsWith("PK") ? "XLSX" : t)),
    );
    eq(
      response.headers.get("content-type"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    assert.match(response.headers.get("cache-control"), /no-store/);
    checks++;
    assert.match(
      response.headers.get("content-disposition"),
      /2001-01-01.*xlsx/,
    );
    checks++;
    const buffer = Buffer.from(await response.arrayBuffer());
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer);
    const orders = objects(book, "Orders").filter((r) =>
      String(r.Id).startsWith(tag),
    );
    eq(orders.length, 232, "No 200-row UI pagination limit in export");
    eq(
      orders.some((r) => r.Id === tag + "-0"),
      false,
      "Before Pakistan midnight excluded",
    );
    eq(
      orders.some((r) => r.Id === tag + "-1"),
      true,
      "Start of Pakistan day included",
    );
    eq(
      orders.some((r) => r.Id === tag + "-2"),
      true,
      "End of Pakistan day included",
    );
    eq(
      orders.some((r) => r.Id === tag + "-3"),
      false,
      "Next Pakistan day excluded",
    );
    eq(
      orders.find((r) => r.Id === tag + "-1")["Customer Name"],
      '=HYPERLINK("https://example.test")',
      "Formula-like names remain plain text",
    );
    eq(
      objects(book, "Order items").filter((r) =>
        String(r["Order / Order Number"]).startsWith(tag),
      ).length,
      232,
    );
    const cash = objects(book, "Account balances").find(
      (r) => r.Code === tag + "cash",
    );
    eq(cash.Opening, 1000);
    eq(cash["Period Debit"], 500);
    eq(cash["Period Credit"], 100);
    eq(cash["Closing Debit Minus Credit"], 1400);
    const summary = objects(book, "Summary");
    const expected =
      await db.$queryRaw`SELECT COALESCE(SUM(CASE WHEN a.kind='INCOME' THEN p.credit-p.debit ELSE 0 END),0)::text AS income, COALESCE(SUM(CASE WHEN a.kind='EXPENSE' THEN p.debit-p.credit ELSE 0 END),0)::text AS expenses FROM "BusinessPosting" p JOIN "BusinessAccount" a ON a.id=p."accountId" JOIN "BusinessJournal" j ON j.id=p."journalId" WHERE j.date='2001-01-01'::date`;
    eq(
      summary.find((r) => r.Metric === "Posted accounting income (PKR)").Value,
      Number(expected[0].income),
    );
    eq(
      summary.find((r) => r.Metric === "Posted net profit (PKR)").Value,
      Number(expected[0].income) - Number(expected[0].expenses),
    );
    for (const name of [
      "Purchases",
      "Purchase items",
      "Current ingredients",
      "Attendance",
      "Payroll",
      "Cash shifts",
      "Current riders",
      "Deliveries",
      "Rider commissions",
      "Rider settlements",
      "Payments",
      "Expenses",
      "Party balances",
      "Read me",
    ]) {
      assert.ok(book.getWorksheet(name), name);
      checks++;
    }
    for (const sheet of book.worksheets)
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          assert.notEqual(cell.type, ExcelJS.ValueType.Formula);
          assert.ok(!String(cell.value).includes("DO-NOT-EXPORT-THIS-HASH"));
        }),
      );
    checks++;
    eq(
      await db.businessJournal.count(),
      countBefore,
      "Export creates no accounting writes",
    );
    eq(
      (await request("?from=1998-01-01&to=1998-01-01", ownerCookie)).status,
      200,
      "Empty dated report remains a valid workbook",
    );
    for (const suffix of [
      "&module=unknown",
      "&format=pdf",
      "&module=riders&format=zip",
      "&module=",
    ]) {
      eq(
        (await request("?from=2001-01-01&to=2001-01-01" + suffix, ownerCookie))
          .status,
        400,
      );
    }
    eq(
      (await request("?from=2001-01-01&to=2001-01-01&format=zip", staffCookie))
        .status,
      403,
    );
    const individual = await request(
      "?from=2001-01-01&to=2001-01-01&module=riders",
      ownerCookie,
    );
    eq(individual.status, 200);
    assert.match(individual.headers.get("content-disposition"), /Riders-2001/);
    checks++;
    const riders = new ExcelJS.Workbook();
    await riders.xlsx.load(Buffer.from(await individual.arrayBuffer()));
    eq(
      riders.worksheets.map((s) => s.name).sort(),
      [
        "Summary",
        "Current riders",
        "Deliveries",
        "Rider commissions",
        "Rider settlements",
        "Party balances",
        "Read me",
      ].sort(),
    );
    const zipped = await request(
      "?from=2001-01-01&to=2001-01-01&format=zip",
      ownerCookie,
    );
    eq(zipped.status, 200);
    eq(zipped.headers.get("content-type"), "application/zip");
    const { createRequire } = require("node:module");
    const JSZip = createRequire(require.resolve("exceljs"))("jszip");
    const archive = await JSZip.loadAsync(
      Buffer.from(await zipped.arrayBuffer()),
      { checkCRC32: true },
    );
    const expectedFiles = [
      "Orders",
      "Inventory",
      "Purchases",
      "Employees",
      "Cash-Shifts",
      "Riders",
      "Financial-Report",
      "Customers",
      "Menu-Tables-Approvals",
    ];
    eq(
      Object.keys(archive.files).sort(),
      expectedFiles.map((n) => n + "-2001-01-01-to-2001-01-01.xlsx").sort(),
    );
    const seen = new Set();
    for (const [name, file] of Object.entries(archive.files)) {
      const child = new ExcelJS.Workbook();
      await child.xlsx.load(await file.async("nodebuffer"));
      assert.ok(child.getWorksheet("Read me"));
      checks++;
      for (const sheet of child.worksheets) seen.add(sheet.name);
      if (name.startsWith("Orders-"))
        eq(objects(child, "Orders").length, objects(book, "Orders").length);
      if (name.startsWith("Financial-")) {
        eq(
          objects(child, "Summary").find(
            (r) => r.Metric === "Posted net profit (PKR)",
          ).Value,
          Number(expected[0].income) - Number(expected[0].expenses),
        );
        eq(
          objects(child, "Summary").some((r) => r.Metric.startsWith("Order")),
          false,
        );
      }
      if (name.startsWith("Employees-"))
        eq(Boolean(child.getWorksheet("Orders")), false);
    }
    eq(
      book.worksheets.every((sheet) => seen.has(sheet.name)),
      true,
      "All original detail sheets preserved across separate files",
    );
    console.log(
      `PASS: ${checks} complete-report HTTP, XLSX, permissions, date-boundary, totals and read-only checks.`,
    );
  } finally {
    await db.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

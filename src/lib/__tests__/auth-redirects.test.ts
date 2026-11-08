import assert from "node:assert/strict";
import { after, test } from "node:test";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { middleware } from "../../middleware";

const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
const previousSecret = process.env.AUTH_SECRET;
process.env.NEXT_PUBLIC_SITE_URL = "https://esellerstore.vip";
process.env.AUTH_SECRET = "test-only-session-secret-for-redirect-regression";
after(() => {
  if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
  if (previousSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = previousSecret;
});

async function redirect(path: string, role?: string) {
  const headers = new Headers({
    host: "esellerstore.vip",
    "x-forwarded-proto": "https",
  });
  if (role) {
    const token = await new SignJWT({ role })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("engineer-cafe")
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    headers.set("cookie", `ec_session=${token}`);
  }
  return middleware(
    new NextRequest(`http://localhost:3100${path}`, { headers }),
  );
}

test("account login redirect uses HTTPS public domain behind a localhost reverse proxy", async () => {
  const response = await redirect("/account/orders?page=2");
  const location = new URL(response.headers.get("location")!);
  assert.equal(location.origin, "https://esellerstore.vip");
  assert.equal(location.pathname, "/login");
  assert.equal(location.searchParams.get("next"), "/account/orders?page=2");
});

test("admin gate retains the return path on the public domain", async () => {
  const response = await redirect("/admin/orders?status=PENDING");
  const location = new URL(response.headers.get("location")!);
  assert.equal(location.origin, "https://esellerstore.vip");
  assert.equal(location.pathname, "/admin/login");
  assert.equal(
    location.searchParams.get("next"),
    "/admin/orders?status=PENDING",
  );
});

test("login remains reachable when a staff token may have been revoked", async () => {
  const response = await redirect("/admin/login", "ADMIN");
  assert.equal(response.headers.get("location"), null);
});

test("customer login remains reachable when its token may be stale", async () => {
  const response = await redirect("/login", "CUSTOMER");
  assert.equal(response.headers.get("location"), null);
});

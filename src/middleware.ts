import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "ec_session";

function secretKey() {
  const secret =
    process.env.AUTH_SECRET ??
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "engineer-cafe-development-secret-do-not-use-in-production");
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  return new TextEncoder().encode(secret);
}

async function readRole(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: "engineer-cafe" });
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * Edge gate for private pages. It is a first line of defence only — every API
 * route and server component re-checks the session against the database.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const role = await readRole(request);
  const isStaff = role === "ADMIN" || role === "STAFF";

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!isStaff) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/admin/login" && isStaff) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/account") && !role) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/register") && role) {
    const url = request.nextUrl.clone();
    url.pathname = isStaff ? "/admin" : "/account";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/login", "/register"],
};

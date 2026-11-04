/** Accept only local application paths after signing in. */
export function safeRedirect(next: string | null, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const target = new URL(next, "https://local.invalid");
    if (target.origin !== "https://local.invalid" || target.pathname === "/admin/login" || target.pathname === "/login" || target.pathname === "/register") return fallback;
    return target.pathname + target.search + target.hash;
  } catch { return fallback; }
}

/**
 * Centralised environment access. Server-only values must never be imported
 * into a client component — everything here is read lazily at call time so
 * that Next.js can tree-shake it out of the browser bundle.
 */

function required(name: string, value: string | undefined, fallback?: string): string {
  if (value && value.length > 0) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(
    `Missing required environment variable "${name}". Copy .env.example to .env and fill it in.`,
  );
}

const isProd = process.env.NODE_ENV === "production";

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL", process.env.DATABASE_URL);
  },
  get authSecret() {
    return required(
      "AUTH_SECRET",
      process.env.AUTH_SECRET ?? process.env.JWT_SECRET,
      isProd ? undefined : "engineer-cafe-development-secret-do-not-use-in-production",
    );
  },
  get siteUrl() {
    // Hosts such as Render expose only a bare hostname, so add the scheme when
    // it is missing rather than letting `new URL()` throw during the build.
    const raw =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.FRONTEND_URL ??
      process.env.RENDER_EXTERNAL_URL ??
      "http://localhost:3000";
    const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
    return withScheme.replace(/\/$/, "");
  },
  get whatsappFallback() {
    return process.env.WHATSAPP_NUMBER ?? "923001234567";
  },
  get uploadProvider() {
    return (process.env.UPLOAD_PROVIDER ?? "local") as "local" | "cloudinary" | "s3";
  },
  get paymentProvider() {
    return (process.env.PAYMENT_PROVIDER ?? "none") as
      | "none"
      | "stripe"
      | "jazzcash"
      | "easypaisa";
  },
  isProd,
};

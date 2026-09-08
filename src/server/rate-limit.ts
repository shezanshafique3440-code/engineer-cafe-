import "server-only";
import { HttpError } from "./api";

type Bucket = { count: number; resetAt: number };

// In-memory fixed-window limiter. Good enough for a single Node process; swap
// the store for Redis/Upstash when running more than one instance.
const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}

export function rateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): void {
  const now = Date.now();
  sweep(now);
  const key = clientKey(request, scope);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const seconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw new HttpError(429, `Too many attempts. Please try again in ${seconds}s.`);
  }
}

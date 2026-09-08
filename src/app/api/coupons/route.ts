import { z } from "zod";
import { handle, json, parseBody } from "@/server/api";
import { getCurrentUser } from "@/server/auth";
import { applyCoupon } from "@/server/pricing";
import { rateLimit } from "@/server/rate-limit";

const schema = z.object({
  code: z.string().trim().min(1, "Enter a promo code.").max(32),
  subtotal: z.number().int().min(0).max(10_000_000),
});

/** Validates a promo code. The discount returned here is advisory — the real
 *  discount is always recalculated at checkout. */
export const POST = handle(async (request: Request) => {
  rateLimit(request, "coupon", 20, 60_000);
  const data = await parseBody(request, schema);
  const user = await getCurrentUser();

  const result = await applyCoupon({
    code: data.code,
    subtotal: data.subtotal,
    userId: user?.id ?? null,
  });

  if (result.couponError) return json({ valid: false, error: result.couponError }, 200);
  return json({ valid: true, coupon: result.coupon, discount: result.discount });
});

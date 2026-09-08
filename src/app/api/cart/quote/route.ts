import { quoteSchema } from "@/lib/validation";
import { handle, json, parseBody } from "@/server/api";
import { getCurrentUser } from "@/server/auth";
import { priceCart } from "@/server/pricing";
import { getSettings } from "@/server/settings";

/**
 * Re-prices the cart entirely on the server. The browser sends product ids,
 * add-on ids and quantities — never prices.
 */
export const POST = handle(async (request: Request) => {
  const data = await parseBody(request, quoteSchema);
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  const quote = await priceCart(
    {
      lines: data.lines,
      couponCode: data.couponCode || null,
      orderType: data.orderType,
      userId: user?.id ?? null,
    },
    settings,
  );

  return json({ quote });
});

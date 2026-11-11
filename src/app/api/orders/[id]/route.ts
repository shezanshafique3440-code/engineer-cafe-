import { handle, json, notFound } from "@/server/api";
import { getCurrentUser } from "@/server/auth";
import { serializeOrder } from "@/server/orders";
import { readableOrder, trackingOrder } from "@/server/order-access";
import { rateLimit } from "@/server/rate-limit";

export const GET = handle(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    rateLimit(request, "order-lookup", 60, 60_000);
    const { id } = await ctx.params;
    const result = await readableOrder(
      id,
      await getCurrentUser(),
      new URL(request.url).searchParams.get("tracking"),
    );
    if (!result)
      throw notFound(
        "We couldn't find that order. Sign in or use the private link from your receipt.",
      );
    const response = json({
      order:
        result.private &&
        new URL(request.url).searchParams.get("view") !== "tracking"
          ? serializeOrder(result.order)
          : trackingOrder(result.order),
    });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  },
);

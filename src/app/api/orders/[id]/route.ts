import { handle, json, notFound } from "@/server/api";
import { getCurrentUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { findOrder, serializeOrder } from "@/server/orders";

/**
 * Order lookup by id or EC#### number. A guest may open an order they placed
 * only by knowing its exact id/number; signed-in customers see their own,
 * staff see everything.
 */
export const GET = handle(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const user = await getCurrentUser();

    const order = await findOrder({
      OR: [{ id }, { orderNumber: id.toUpperCase() }],
    });
    if (!order) throw notFound("We couldn't find that order.");

    if (!(can(user, "orders") || (can(user, "pos") && order.cashierId === user?.id) || (order.userId && order.userId === user?.id) || (!order.userId && order.source === "WEB" && id === order.id))) {
      throw notFound("We couldn't find that order.");
    }

    return json({ order: serializeOrder(order) });
  },
);

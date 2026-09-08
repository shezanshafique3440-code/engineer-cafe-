import { handle, json, notFound } from "@/server/api";
import { getCurrentUser, isStaff } from "@/server/auth";
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

    if (order.userId && !isStaff(user?.role) && order.userId !== user?.id) {
      throw notFound("We couldn't find that order.");
    }

    return json({ order: serializeOrder(order) });
  },
);

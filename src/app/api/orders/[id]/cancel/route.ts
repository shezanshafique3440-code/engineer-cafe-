import { handle, json, notFound, requireUser, badRequest } from "@/server/api";
import { findOrder, serializeOrder, transitionOrder } from "@/server/orders";

/** A customer may cancel only while the order hasn't been prepared yet. */
export const POST = handle(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();

    const order = await findOrder({
      AND: [{ OR: [{ id }, { orderNumber: id.toUpperCase() }] }, { userId: user.id }],
    });
    if (!order) throw notFound("We couldn't find that order.");
    if (order.status === "CANCELLED") throw badRequest("This order is already cancelled.");
    if (!["PENDING", "CONFIRMED"].includes(order.status)) {
      throw badRequest("This order is already being prepared and can no longer be cancelled.");
    }

    const updated = await transitionOrder(order, "CANCELLED", "Cancelled by customer");
    return json({ order: serializeOrder(updated) });
  },
);

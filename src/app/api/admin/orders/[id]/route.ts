import { prisma } from "@/lib/prisma";
import { orderDeleteSchema, orderStatusSchema } from "@/lib/validation";
import { handle, json, notFound, parseBody, requireAdmin, badRequest, forbidden } from "@/server/api";
import { deleteOrder, findOrder, serializeOrder, transitionOrder } from "@/server/orders";

export const GET = handle(async (_r: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const order = await findOrder({ OR: [{ id }, { orderNumber: id.toUpperCase() }] });
  if (!order) throw notFound("Order not found.");
  return json({ order: serializeOrder(order) });
});

export const PATCH = handle(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const data = await parseBody(request, orderStatusSchema);

  const order = await prisma.order.findFirst({
    where: { OR: [{ id }, { orderNumber: id.toUpperCase() }] },
  });
  if (!order) throw notFound("Order not found.");
  if (order.status === "CANCELLED") throw badRequest("Cancelled orders cannot be reopened. Create a new order instead.");
  if (order.orderType === "PICKUP" && data.status === "OUT_FOR_DELIVERY") throw badRequest("Pickup orders cannot go out for delivery.");
  if (order.status === data.status) throw badRequest("The order is already in that status.");
  if (order.status === "DELIVERED" && data.status !== "CANCELLED") {
    throw badRequest("A delivered order can no longer change status.");
  }

  const updated = await transitionOrder(order, data.status, data.note || undefined);
  return json({ order: serializeOrder(updated) });
});

export const DELETE = handle(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireAdmin();
    if (user.role !== "ADMIN")
      throw forbidden("Only an admin can permanently delete orders.");
    const { id } = await ctx.params;
    const confirmation = await parseBody(request, orderDeleteSchema);
    const deleted = await deleteOrder(id, confirmation);
    return json({
      ok: true,
      ...deleted,
      message: `Order #${deleted.orderNumber} deleted.`,
    });
  },
);

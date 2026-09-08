import { prisma } from "@/lib/prisma";
import { orderStatusSchema } from "@/lib/validation";
import { handle, json, notFound, parseBody, requireAdmin, badRequest } from "@/server/api";
import { findOrder, serializeOrder, transitionOrder } from "@/server/orders";

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
  if (order.status === data.status) throw badRequest("The order is already in that status.");
  if (order.status === "DELIVERED" && data.status !== "CANCELLED") {
    throw badRequest("A delivered order can no longer change status.");
  }

  const updated = await transitionOrder(order, data.status, data.note || undefined);
  return json({ order: serializeOrder(updated) });
});

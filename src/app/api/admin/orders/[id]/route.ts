import { canBusiness, waiterOrderScope } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";
import { orderDeleteSchema, orderStatusSchema } from "@/lib/validation";
import {
  handle,
  json,
  notFound,
  parseBody,
  requireAdmin,
  badRequest,
  forbidden,
} from "@/server/api";
import {
  deleteOrder,
  findOrder,
  serializeOrder,
  transitionOrder,
} from "@/server/orders";

export const GET = handle(
  async (_r: Request, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireAdmin("orders");
    const { id } = await ctx.params;
    const order = await findOrder({
      ...waiterOrderScope(actor),
      OR: [{ id }, { orderNumber: id.toUpperCase() }],
    });
    if (!order) throw notFound("Order not found.");
    return json({ order: serializeOrder(order) });
  },
);

export const PATCH = handle(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireAdmin("orders");
    const { id } = await ctx.params;
    const data = await parseBody(request, orderStatusSchema);

    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id.toUpperCase() }] },
    });
    if (!order) throw notFound("Order not found.");
    if (order.status === "CANCELLED")
      throw badRequest(
        "Cancelled orders cannot be reopened. Create a new order instead.",
      );
    if (order.orderType === "PICKUP" && data.status === "OUT_FOR_DELIVERY")
      throw badRequest("Pickup orders cannot go out for delivery.");
    if (order.status === data.status)
      throw badRequest("The order is already in that status.");
    if (order.status === "DELIVERED" && data.status !== "CANCELLED") {
      throw badRequest("A delivered order can no longer change status.");
    }

    const servingTable =
      actor.businessProfile === "WAITER" &&
      order.serviceMode === "DINE_IN" &&
      data.status === "DELIVERED" &&
      order.status === "READY" &&
      (await prisma.tableSession.findFirst({
        where: {
          id: order.tableSessionId ?? "none",
          waiterId: actor.employeeId ?? "none",
        },
      }));
    if (
      ["DELIVERED", "CANCELLED"].includes(data.status) &&
      !canBusiness(actor, "payments") &&
      !servingTable
    )
      throw forbidden(
        "A cashier or manager must handle payments and cancellations.",
      );
    if (
      (actor.businessProfile === "CHEF" &&
        !["CONFIRMED", "PREPARING", "READY"].includes(data.status)) ||
      (actor.businessProfile === "WAITER" && !servingTable)
    )
      throw forbidden("This status action is outside your staff role.");

    const updated = await transitionOrder(
      order,
      data.status,
      data.note || undefined,
      actor,
    );
    return json({ order: serializeOrder(updated) });
  },
);

export const DELETE = handle(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireAdmin("orders");
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

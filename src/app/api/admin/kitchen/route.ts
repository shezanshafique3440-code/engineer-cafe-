import { waiterOrderScope } from "@/lib/business-access";
import { canBusiness } from "@/lib/business-access";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { KITCHEN_LANES, kitchenNext } from "@/lib/kitchen";
import {
  handle,
  json,
  requireAdmin,
  parseBody,
  notFound,
  badRequest,
  HttpError,
} from "@/server/api";
import { serializeOrder, transitionOrder } from "@/server/orders";

export const GET = handle(async () => {
  const actor = await requireAdmin("kitchen");
  const scope = waiterOrderScope(actor);
  const where = { ...scope, status: { in: [...KITCHEN_LANES] } };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "asc" },
      take: 150,
      include: {
        items: { include: { addons: true } },
        events: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return json({
    tickets: rows.map((order) => ({
      ...serializeOrder(order),
      version: order.updatedAt.toISOString(),
    })),
    total,
    fetchedAt: new Date().toISOString(),
  });
});
export const PATCH = handle(async (request: Request) => {
  const staff = await requireAdmin("kitchen");
  const data = await parseBody(
    request,
    z.object({
      id: z.string().min(1).max(100),
      version: z.string().datetime(),
      status: z.enum([
        "CONFIRMED",
        "PREPARING",
        "READY",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
      ]),
    }),
  );
  const order = await prisma.order.findUnique({ where: { id: data.id } });
  if (!order) throw notFound("Order no longer exists.");
  if (
    order.updatedAt.toISOString() !== data.version ||
    kitchenNext(order.status, order.orderType) !== data.status
  ) {
    throw new HttpError(
      409,
      "This ticket changed on another screen. Refresh before continuing.",
    );
  }
  if (
    data.status === "DELIVERED" &&
    order.paymentMethod === "ONLINE" &&
    order.paymentStatus !== "PAID"
  )
    throw badRequest("Online payment must be confirmed before handover.");
  const servingTable =
    staff.businessProfile === "WAITER" &&
    order.serviceMode === "DINE_IN" &&
    data.status === "DELIVERED" &&
    order.status === "READY" &&
    (await prisma.tableSession.findFirst({
      where: {
        id: order.tableSessionId ?? "none",
        waiterId: staff.employeeId ?? "none",
      },
    }));
  if (
    data.status === "DELIVERED" &&
    !canBusiness(staff, "payments") &&
    !servingTable
  )
    throw new HttpError(
      403,
      "A cashier must handle payment, or the assigned waiter can serve this table.",
    );
  if (staff.businessProfile === "WAITER" && !servingTable)
    throw new HttpError(
      403,
      "Only the assigned waiter can serve a ready table ticket.",
    );
  if (
    staff.businessProfile === "CHEF" &&
    !["CONFIRMED", "PREPARING", "READY"].includes(data.status)
  )
    throw new HttpError(
      403,
      "Chefs can confirm and prepare food; dispatch belongs to the cashier.",
    );
  const updated = await transitionOrder(
    order,
    data.status,
    `Kitchen: ${staff.name}`,
    staff,
  );
  return json({
    ticket: {
      ...serializeOrder(updated),
      version: updated.updatedAt.toISOString(),
    },
  });
});

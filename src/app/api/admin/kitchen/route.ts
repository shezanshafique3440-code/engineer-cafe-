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
  await requireAdmin();
  const where = { status: { in: [...KITCHEN_LANES] } };
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
  const staff = await requireAdmin();
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
  const updated = await transitionOrder(
    order,
    data.status,
    `Kitchen: ${staff.name}`,
  );
  return json({
    ticket: {
      ...serializeOrder(updated),
      version: updated.updatedAt.toISOString(),
    },
  });
});

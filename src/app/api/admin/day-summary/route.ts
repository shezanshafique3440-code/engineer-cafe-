import { handle, json, requireUser, forbidden } from "@/server/api";
import { prisma } from "@/lib/prisma";
import { canBusiness, waiterOrderScope } from "@/lib/business-access";
export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const actor = await requireUser();
  if (!["ADMIN", "STAFF"].includes(actor.role)) throw forbidden();
  const [config, orders, tables, shift, unassigned] = await Promise.all([
    prisma.businessConfig.findUnique({
      where: { id: 1 },
      select: { enabled: true },
    }),
    canBusiness(actor, "orders")
      ? prisma.order.count({
          where: {
            ...waiterOrderScope(actor),
            status: { notIn: ["DELIVERED", "CANCELLED"] },
          },
        })
      : null,
    canBusiness(actor, "tables")
      ? prisma.tableSession.count({
          where: {
            closedAt: null,
            ...(actor.businessProfile === "WAITER"
              ? { waiterId: actor.employeeId ?? "unassigned" }
              : {}),
          },
        })
      : null,
    canBusiness(actor, "cash")
      ? prisma.cashShift.findFirst({
          where: { openedById: actor.id, closedAt: null },
          select: { id: true, drawer: { select: { name: true } } },
        })
      : null,
    canBusiness(actor, "delivery")
      ? prisma.order.count({
          where: {
            businessTracked: true,
            orderType: "DELIVERY",
            riderId: null,
            status: { notIn: ["DELIVERED", "CANCELLED"] },
          },
        })
      : null,
  ]);
  const response = json({
    integrationActive: Boolean(config?.enabled),
    orders,
    tables,
    shift,
    unassigned,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});

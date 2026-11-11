import { businessDayStart } from "@/lib/business-math";
import { waiterOrderScope } from "@/lib/business-access";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json, parseQuery, requireAdmin, badRequest } from "@/server/api";
import { serializeOrder } from "@/server/orders";

const querySchema = z.object({
  search: z.string().max(80).optional(),
  status: z
    .enum([
      "ALL",
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
    ])
    .default("ALL"),
  orderType: z.enum(["ALL", "DELIVERY", "PICKUP"]).default("ALL"),
  from: z.string().max(30).optional(),
  to: z.string().max(30).optional(),
  page: z.coerce.number().int().min(1).max(999).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handle(async (request: Request) => {
  const actor = await requireAdmin("orders");
  const scope = waiterOrderScope(actor);
  const q = parseQuery(request, querySchema);

  const createdAt: { gte?: Date; lt?: Date } = {};
  try {
    if (q.from) createdAt.gte = businessDayStart(q.from);
    if (q.to) createdAt.lt = new Date(businessDayStart(q.to).getTime() + 86400000);
  } catch { throw badRequest("Choose real calendar dates."); }
  if (createdAt.gte && createdAt.lt && createdAt.gte >= createdAt.lt) throw badRequest("From must be before To.");

  const where = {
    ...scope,
    ...(q.status !== "ALL" ? { status: q.status } : {}),
    ...(q.orderType !== "ALL" ? { orderType: q.orderType } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
    ...(q.search
      ? {
          OR: [
            {
              orderNumber: { contains: q.search, mode: "insensitive" as const },
            },
            {
              customerName: {
                contains: q.search,
                mode: "insensitive" as const,
              },
            },
            { customerPhone: { contains: q.search } },
            { tableName: { contains: q.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [orders, total, statusCounts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.perPage,
      take: q.perPage,
      include: {
        items: { include: { addons: true } },
        events: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({
      where: scope,
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  return json({
    orders: orders.map(serializeOrder),
    total,
    page: q.page,
    perPage: q.perPage,
    totalPages: Math.max(1, Math.ceil(total / q.perPage)),
    statusCounts: Object.fromEntries(
      statusCounts.map((s) => [s.status, s._count.status]),
    ),
  });
});

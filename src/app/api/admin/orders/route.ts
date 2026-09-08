import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json, parseQuery, requireAdmin } from "@/server/api";
import { serializeOrder } from "@/server/orders";

const querySchema = z.object({
  search: z.string().max(80).optional(),
  status: z
    .enum(["ALL", "PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"])
    .default("ALL"),
  orderType: z.enum(["ALL", "DELIVERY", "PICKUP"]).default("ALL"),
  from: z.string().max(30).optional(),
  to: z.string().max(30).optional(),
  page: z.coerce.number().int().min(1).max(999).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handle(async (request: Request) => {
  await requireAdmin();
  const q = parseQuery(request, querySchema);

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (q.from) {
    const d = new Date(q.from);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  }
  if (q.to) {
    const d = new Date(q.to);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      createdAt.lte = d;
    }
  }

  const where = {
    ...(q.status !== "ALL" ? { status: q.status } : {}),
    ...(q.orderType !== "ALL" ? { orderType: q.orderType } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
    ...(q.search
      ? {
          OR: [
            { orderNumber: { contains: q.search, mode: "insensitive" as const } },
            { customerName: { contains: q.search, mode: "insensitive" as const } },
            { customerPhone: { contains: q.search } },
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
      include: { items: { include: { addons: true } }, events: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], _count: { status: true } }),
  ]);

  return json({
    orders: orders.map(serializeOrder),
    total,
    page: q.page,
    perPage: q.perPage,
    totalPages: Math.max(1, Math.ceil(total / q.perPage)),
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count.status])),
  });
});

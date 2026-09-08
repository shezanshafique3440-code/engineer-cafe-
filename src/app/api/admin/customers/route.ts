import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json, parseQuery, requireAdmin } from "@/server/api";

const querySchema = z.object({
  search: z.string().max(80).optional(),
  role: z.enum(["ALL", "CUSTOMER", "STAFF", "ADMIN"]).default("ALL"),
  page: z.coerce.number().int().min(1).max(999).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handle(async (request: Request) => {
  await requireAdmin();
  const q = parseQuery(request, querySchema);

  const where = {
    ...(q.role !== "ALL" ? { role: q.role } : {}),
    ...(q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: "insensitive" as const } },
            { email: { contains: q.search, mode: "insensitive" as const } },
            { phone: { contains: q.search } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.perPage,
      take: q.perPage,
      select: {
        id: true, name: true, email: true, phone: true, role: true, isActive: true,
        createdAt: true, lastLoginAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // Lifetime value per customer, excluding cancelled orders.
  const spendRows = await prisma.order.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((u) => u.id) }, status: { not: "CANCELLED" } },
    _sum: { total: true },
  });
  const spendMap = new Map(spendRows.map((r) => [r.userId, r._sum.total ?? 0]));

  return json({
    customers: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      orderCount: u._count.orders,
      totalSpent: spendMap.get(u.id) ?? 0,
    })),
    total,
    page: q.page,
    perPage: q.perPage,
    totalPages: Math.max(1, Math.ceil(total / q.perPage)),
  });
});

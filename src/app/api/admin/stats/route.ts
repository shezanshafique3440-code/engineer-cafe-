import { prisma } from "@/lib/prisma";
import { handle, json, requireAdmin } from "@/server/api";

const REVENUE_STATUSES = ["CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export const GET = handle(async () => {
  await requireAdmin();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

  const [
    todayAgg,
    yesterdayAgg,
    monthAgg,
    todayOrders,
    pendingOrders,
    activeOrders,
    completedOrders,
    totalCustomers,
    newCustomersToday,
    pendingReviews,
    newMessages,
    lowStock,
    bestSelling,
    recentOrders,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: { gte: startOfToday }, status: { in: [...REVENUE_STATUSES] } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfYesterday, lt: startOfToday },
        status: { in: [...REVENUE_STATUSES] },
      },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: startOfMonth }, status: { in: [...REVENUE_STATUSES] } },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: { in: ["CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] } } }),
    prisma.order.count({ where: { status: "DELIVERED" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: startOfToday } } }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    prisma.product.count({ where: { stock: { lte: 5, not: null } } }),
    prisma.product.findFirst({
      where: { soldCount: { gt: 0 } },
      orderBy: { soldCount: "desc" },
      select: { id: true, name: true, slug: true, image: true, soldCount: true, price: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, orderNumber: true, customerName: true, total: true,
        status: true, orderType: true, createdAt: true,
        _count: { select: { items: true } },
      },
    }),
  ]);

  const todaySales = todayAgg._sum.total ?? 0;
  const yesterdaySales = yesterdayAgg._sum.total ?? 0;

  return json({
    stats: {
      todaySales,
      yesterdaySales,
      salesChangePercent:
        yesterdaySales > 0
          ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100)
          : null,
      monthSales: monthAgg._sum.total ?? 0,
      todayOrders,
      pendingOrders,
      activeOrders,
      completedOrders,
      totalCustomers,
      newCustomersToday,
      pendingReviews,
      newMessages,
      lowStock,
      bestSelling,
    },
    recentOrders: recentOrders.map((o) => ({
      ...o,
      itemCount: o._count.items,
      createdAt: o.createdAt.toISOString(),
    })),
  });
});

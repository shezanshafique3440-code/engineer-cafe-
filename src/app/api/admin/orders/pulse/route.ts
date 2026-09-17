import { prisma } from "@/lib/prisma";
import { handle, json, requireAdmin } from "@/server/api";

/**
 * A deliberately tiny endpoint the admin shell polls so staff hear a new order
 * arrive from any admin page. Two indexed reads, no aggregates — the dashboard
 * stats endpoint is far too heavy to call on a timer.
 */
export const GET = handle(async () => {
  await requireAdmin();

  const [pendingCount, latest] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.findFirst({
      orderBy: { placedAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        total: true,
        orderType: true,
        placedAt: true,
      },
    }),
  ]);

  return json({
    pendingCount,
    latest: latest ? { ...latest, placedAt: latest.placedAt.toISOString() } : null,
  });
});

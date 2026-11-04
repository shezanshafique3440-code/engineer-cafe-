import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json, parseQuery, requireAdmin } from "@/server/api";
import { buildInsights } from "@/lib/cafe-insights";

export const GET = handle(async (request: Request) => {
  await requireAdmin();
  const { days } = parseQuery(
    request,
    z.object({ days: z.coerce.number().int().min(7).max(365).default(90) }),
  );
  const since = new Date(Date.now() - days * 86_400_000);
  const [rows, products] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5001,
      select: {
        id: true,
        userId: true,
        customerName: true,
        customerPhone: true,
        status: true,
        paymentStatus: true,
        total: true,
        createdAt: true,
        items: {
          select: {
            productId: true,
            productName: true,
            quantity: true,
            lineTotal: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      take: 2000,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        isAvailable: true,
        stock: true,
        ratingAverage: true,
        ratingCount: true,
      },
    }),
  ]);
  return json({
    ...buildInsights(
      rows
        .slice(0, 5000)
        .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      products,
    ),
    range: {
      days,
      since: since.toISOString(),
      sampledOrders: Math.min(rows.length, 5000),
      truncated: rows.length > 5000,
      menuTruncated: products.length === 2000,
      timezone: "Asia/Karachi",
    },
  });
});

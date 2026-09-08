import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json, parseQuery, requireAdmin } from "@/server/api";

const querySchema = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) });

const REVENUE_STATUSES = ["CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const GET = handle(async (request: Request) => {
  await requireAdmin();
  const { days } = parseQuery(request, querySchema);

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since } },
    select: {
      createdAt: true,
      total: true,
      status: true,
      orderType: true,
      paymentMethod: true,
      items: { select: { quantity: true, lineTotal: true, productId: true, productName: true } },
    },
  });

  // Daily series, zero-filled so charts never have gaps.
  const daily = new Map<string, { date: string; sales: number; orders: number }>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    daily.set(dayKey(d), { date: dayKey(d), sales: 0, orders: 0 });
  }

  const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>();
  const typeTotals = { DELIVERY: 0, PICKUP: 0 };
  const paymentTotals: Record<string, number> = {};
  let grossSales = 0;
  let countedOrders = 0;

  for (const order of orders) {
    const key = dayKey(order.createdAt);
    const bucket = daily.get(key);
    const counted = (REVENUE_STATUSES as readonly string[]).includes(order.status);

    if (bucket) {
      bucket.orders += 1;
      if (counted) bucket.sales += order.total;
    }
    if (!counted) continue;

    grossSales += order.total;
    countedOrders += 1;
    typeTotals[order.orderType] += 1;
    paymentTotals[order.paymentMethod] = (paymentTotals[order.paymentMethod] ?? 0) + 1;

    for (const item of order.items) {
      const id = item.productId ?? item.productName;
      const entry = productTotals.get(id) ?? { name: item.productName, quantity: 0, revenue: 0 };
      entry.quantity += item.quantity;
      entry.revenue += item.lineTotal;
      productTotals.set(id, entry);
    }
  }

  // Sales by category, from live product/category links.
  const categoryRows = await prisma.category.findMany({
    select: {
      name: true,
      products: { select: { id: true, soldCount: true } },
    },
  });

  const soldByProduct = new Map(
    [...productTotals.entries()].map(([id, v]) => [id, v.quantity]),
  );
  const byCategory = categoryRows
    .map((c) => ({
      name: c.name,
      quantity: c.products.reduce((sum, p) => sum + (soldByProduct.get(p.id) ?? 0), 0),
    }))
    .filter((c) => c.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity);

  const dailySeries = [...daily.values()];

  // Weekly rollup (ISO-ish: groups of 7 from the start of the window).
  const weekly: { week: string; sales: number; orders: number }[] = [];
  for (let i = 0; i < dailySeries.length; i += 7) {
    const chunk = dailySeries.slice(i, i + 7);
    weekly.push({
      week: `${chunk[0].date.slice(5)} – ${chunk[chunk.length - 1].date.slice(5)}`,
      sales: chunk.reduce((s, d) => s + d.sales, 0),
      orders: chunk.reduce((s, d) => s + d.orders, 0),
    });
  }

  // Monthly rollup over the last 12 months.
  const yearAgo = new Date();
  yearAgo.setMonth(yearAgo.getMonth() - 11, 1);
  yearAgo.setHours(0, 0, 0, 0);
  const yearOrders = await prisma.order.findMany({
    where: { createdAt: { gte: yearAgo }, status: { in: [...REVENUE_STATUSES] } },
    select: { createdAt: true, total: true },
  });
  const monthlyMap = new Map<string, { month: string; sales: number; orders: number }>();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(yearAgo);
    d.setMonth(yearAgo.getMonth() + i);
    const key = d.toISOString().slice(0, 7);
    monthlyMap.set(key, {
      month: d.toLocaleDateString("en-PK", { month: "short", year: "2-digit" }),
      sales: 0,
      orders: 0,
    });
  }
  for (const order of yearOrders) {
    const key = order.createdAt.toISOString().slice(0, 7);
    const bucket = monthlyMap.get(key);
    if (bucket) {
      bucket.sales += order.total;
      bucket.orders += 1;
    }
  }

  return json({
    range: { days, from: dayKey(since) },
    summary: {
      grossSales,
      orders: countedOrders,
      averageOrderValue: countedOrders ? Math.round(grossSales / countedOrders) : 0,
      itemsSold: [...productTotals.values()].reduce((s, p) => s + p.quantity, 0),
    },
    daily: dailySeries,
    weekly,
    monthly: [...monthlyMap.values()],
    topProducts: [...productTotals.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8),
    byCategory,
    byOrderType: [
      { name: "Delivery", value: typeTotals.DELIVERY },
      { name: "Pickup", value: typeTotals.PICKUP },
    ],
    byPayment: Object.entries(paymentTotals).map(([name, value]) => ({ name, value })),
  });
});

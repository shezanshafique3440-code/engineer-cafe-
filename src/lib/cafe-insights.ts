export type InsightOrder = {
  id: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  items: {
    productId: string | null;
    productName: string;
    quantity: number;
    lineTotal: number;
  }[];
};
export type InsightProduct = {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  stock: number | null;
  ratingAverage: number;
  ratingCount: number;
};
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function customerKey(
  order: Pick<InsightOrder, "id" | "userId" | "customerPhone">,
) {
  let phone = order.customerPhone.replace(/\D/g, "");
  if (phone.startsWith("0092")) phone = phone.slice(2);
  if (/^03\d{9}$/.test(phone)) phone = `92${phone.slice(1)}`;
  if (/^3\d{9}$/.test(phone)) phone = `92${phone}`;
  return phone.length >= 10 && phone.length <= 15
    ? `phone:${phone}`
    : order.userId
      ? `user:${order.userId}`
      : `guest:${order.id}`;
}
export function buildInsights(
  orders: InsightOrder[],
  products: InsightProduct[],
  now = Date.now(),
) {
  const heatmap = weekdays.map((day) => ({
    day,
    hours: Array<number>(24).fill(0),
  }));
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const customers = new Map<
    string,
    {
      key: string;
      name: string;
      phone: string;
      orders: number;
      spend: number;
      lastOrderAt: string;
    }
  >();
  const sales = new Map<string, { quantity: number; revenue: number }>();
  let delivered = 0,
    deliveredValue = 0,
    paidValue = 0,
    outstanding = 0,
    cancelled = 0;
  for (const order of orders) {
    if (order.status === "CANCELLED") {
      cancelled++;
      continue;
    }
    const parts = format.formatToParts(new Date(order.createdAt));
    const day = weekdays.indexOf(
      parts.find((p) => p.type === "weekday")?.value ?? "",
    );
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    if (day >= 0 && hour >= 0 && hour < 24) heatmap[day].hours[hour]++;
    if (
      order.paymentStatus === "UNPAID" &&
      [
        "CONFIRMED",
        "PREPARING",
        "READY",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
      ].includes(order.status)
    )
      outstanding += order.total;
    if (order.status !== "DELIVERED") continue;
    delivered++;
    deliveredValue += order.total;
    if (order.paymentStatus === "PAID") paidValue += order.total;
    const key = customerKey(order);
    const current = customers.get(key) ?? {
      key,
      name: order.customerName,
      phone: order.customerPhone,
      orders: 0,
      spend: 0,
      lastOrderAt: order.createdAt,
    };
    current.orders++;
    current.spend += order.total;
    if (order.createdAt > current.lastOrderAt) {
      current.lastOrderAt = order.createdAt;
      current.name = order.customerName;
      current.phone = order.customerPhone;
    }
    customers.set(key, current);
    for (const item of order.items) {
      if (!item.productId) continue;
      const row = sales.get(item.productId) ?? { quantity: 0, revenue: 0 };
      row.quantity += item.quantity;
      row.revenue += item.lineTotal;
      sales.set(item.productId, row);
    }
  }
  const averageCustomerValue = customers.size
    ? deliveredValue / customers.size
    : 0;
  const segments = [...customers.values()]
    .map((customer) => {
      const daysSince = Math.max(
        0,
        Math.floor(
          (now - new Date(customer.lastOrderAt).getTime()) / 86_400_000,
        ),
      );
      const segment =
        customer.orders >= 2 && daysSince >= 21
          ? "At risk"
          : customer.orders >= 3 && customer.spend >= averageCustomerValue * 1.5
            ? "VIP"
            : customer.orders >= 2
              ? "Returning"
              : "New";
      return { ...customer, daysSince, segment };
    })
    .sort((a, b) => b.spend - a.spend);
  const menu = products
    .map((product) => {
      const sold = sales.get(product.id) ?? { quantity: 0, revenue: 0 };
      const signal = !product.isAvailable
        ? "Paused"
        : product.stock !== null && product.stock <= 5
          ? "Low stock"
          : !sold.quantity
            ? "Not ordered"
            : product.ratingCount >= 3 &&
                product.ratingAverage >= 4.5 &&
                sold.quantity < 5
              ? "Hidden gem"
              : sold.quantity >= 5
                ? "Popular"
                : "Steady";
      return { ...product, ...sold, signal };
    })
    .sort((a, b) => b.revenue - a.revenue);
  let peak: { day: string; hour: number; orders: number } | null = null;
  for (const row of heatmap) {
    for (let hour = 0; hour < 24; hour++) {
      const count = row.hours[hour];
      if (count > (peak?.orders ?? 0))
        peak = { day: row.day, hour, orders: count };
    }
  }
  return {
    summary: {
      delivered,
      deliveredValue,
      paidValue,
      outstanding,
      cancelled,
      cancellationRate: orders.length
        ? Math.round((cancelled / orders.length) * 100)
        : 0,
      averageOrderValue: delivered ? Math.round(deliveredValue / delivered) : 0,
      customers: customers.size,
      repeatRate: customers.size
        ? Math.round(
            (segments.filter((c) => c.orders >= 2).length / customers.size) *
              100,
          )
        : 0,
    },
    customers: segments,
    menu,
    heatmap,
    peak,
  };
}
export type CafeInsights = ReturnType<typeof buildInsights>;

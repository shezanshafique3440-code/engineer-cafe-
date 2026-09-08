import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { serializeOrder } from "@/server/orders";
import { buildMetadata } from "@/lib/seo";
import { OrderHistory } from "@/components/account/order-history";

export const metadata: Metadata = buildMetadata({
  title: "My Orders",
  path: "/account/orders",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: { include: { addons: true } }, events: { orderBy: { createdAt: "asc" } } },
  });

  return <OrderHistory orders={orders.map(serializeOrder)} />;
}

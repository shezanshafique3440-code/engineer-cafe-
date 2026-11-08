import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { findOrder, serializeOrder } from "@/server/orders";
import { buildMetadata } from "@/lib/seo";
import { OrderTracker } from "@/components/cart/order-tracker";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return buildMetadata({
    title: `Order ${id.toUpperCase()}`,
    description: "Track your Engineer Cafe order.",
    path: `/orders/${id}`,
    noIndex: true,
  });
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, user] = await Promise.all([
    findOrder({ OR: [{ id }, { orderNumber: id.toUpperCase() }] }),
    getCurrentUser(),
  ]);

  // An order attached to an account is only visible to that customer or staff.
  if (!order) notFound();
  if (!(can(user, "orders") || (can(user, "pos") && order.cashierId === user?.id) || (order.userId && order.userId === user?.id) || (!order.userId && order.source === "WEB" && id === order.id))) notFound();

  return (
    <Suspense fallback={<div className="container py-16" />}>
      <OrderTracker initialOrder={serializeOrder(order)} />
    </Suspense>
  );
}

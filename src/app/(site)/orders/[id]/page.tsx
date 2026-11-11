import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { serializeOrder } from "@/server/orders";
import { readableOrder, trackingOrder } from "@/server/order-access";
import { buildMetadata } from "@/lib/seo";
import { PublicOrderTracker } from "@/components/cart/public-order-tracker";
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

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tracking?: string }> }) {
  const { id } = await params;
  const { tracking } = await searchParams;
  const result = await readableOrder(id, await getCurrentUser(), tracking ?? null);
  if (!result) notFound();
  return <Suspense fallback={<div className="container py-16" />}>
    {result.private ? <OrderTracker initialOrder={serializeOrder(result.order)} /> : <PublicOrderTracker initialOrder={trackingOrder(result.order)} />}
  </Suspense>;
}

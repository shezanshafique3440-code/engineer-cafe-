import type { Metadata } from "next";
import { OrdersManager } from "@/components/admin/orders-manager";

export const metadata: Metadata = { title: "Orders" };

export default function AdminOrdersPage() {
  return <OrdersManager />;
}

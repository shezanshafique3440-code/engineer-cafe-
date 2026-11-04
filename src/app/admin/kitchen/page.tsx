import type { Metadata } from "next";
import { KitchenBoard } from "@/components/premium/kitchen-board";
export const metadata: Metadata = { title: "Kitchen Live" };
export default function KitchenPage() {
  return <KitchenBoard />;
}

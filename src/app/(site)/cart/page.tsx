import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = buildMetadata({
  title: "Your Cart",
  description: "Review your Engineer Cafe order before checkout.",
  path: "/cart",
  noIndex: true,
});

export default function CartPage() {
  return <CartView />;
}

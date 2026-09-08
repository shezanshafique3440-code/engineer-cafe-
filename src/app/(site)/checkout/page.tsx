import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { CheckoutView } from "@/components/cart/checkout-view";

export const metadata: Metadata = buildMetadata({
  title: "Checkout",
  description: "Complete your Engineer Cafe order.",
  path: "/checkout",
  noIndex: true,
});

export default function CheckoutPage() {
  return <CheckoutView />;
}

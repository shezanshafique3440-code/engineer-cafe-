import type { Metadata } from "next";
import { ProductComparison } from "@/components/storefront/comparison";
export const metadata: Metadata = {
  title: "Compare your favourites",
  robots: { index: false, follow: false },
};
export default function ComparePage() {
  return <ProductComparison />;
}

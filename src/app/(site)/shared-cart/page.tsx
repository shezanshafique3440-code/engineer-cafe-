import type { Metadata } from "next";
import { SharedCartPreview } from "@/components/premium/shared-cart";
export const metadata: Metadata = {
  title: "A meal shared with you",
  robots: { index: false, follow: false },
};
export default function SharedCartPage() {
  return <SharedCartPreview />;
}

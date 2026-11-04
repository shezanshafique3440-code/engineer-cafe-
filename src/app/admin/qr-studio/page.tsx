import type { Metadata } from "next";
import { QrStudio } from "@/components/premium/qr-studio";
export const metadata: Metadata = { title: "QR Menu Studio" };
export default function QrPage() {
  return <QrStudio />;
}

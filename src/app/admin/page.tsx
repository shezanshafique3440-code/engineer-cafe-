import type { Metadata } from "next";
import { DailyHome } from "@/components/admin/daily-home";
export const metadata: Metadata = { title: "Roz ka kaam" };
export default function Page() {
  return <DailyHome />;
}

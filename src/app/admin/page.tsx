import type { Metadata } from "next";
import { DailyHome } from "@/components/admin/daily-home";
export const metadata: Metadata = { title: "Daily home" };
export default function Page() {
  return <DailyHome />;
}

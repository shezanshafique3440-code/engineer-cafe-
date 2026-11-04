import type { Metadata } from "next";
import { InsightsWorkspace } from "@/components/premium/insights-workspace";
export const metadata: Metadata = { title: "Business Intelligence" };
export default function InsightsPage() {
  return <InsightsWorkspace />;
}

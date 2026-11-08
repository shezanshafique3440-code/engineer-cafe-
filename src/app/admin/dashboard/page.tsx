import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/dashboard";
import { getCurrentUser } from "@/server/auth";
import { canBusiness } from "@/lib/business-access";
export const metadata: Metadata = { title: "Dashboard" };
export default async function Page() {
  if (!canBusiness(await getCurrentUser(), "insights")) redirect("/admin");
  return <AdminDashboard />;
}

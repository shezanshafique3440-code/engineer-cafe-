import { DemoDataManager } from "@/components/admin/demo-data-manager";
import { getCurrentUser } from "@/server/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "ADMIN") redirect("/admin");
  return <DemoDataManager />;
}

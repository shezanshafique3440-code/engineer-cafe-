import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { SystemHealth } from "@/components/admin/system-health";
export const dynamic = "force-dynamic";
export default async function SystemPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();
  return <SystemHealth />;
}

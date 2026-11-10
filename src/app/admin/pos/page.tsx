import { redirect } from "next/navigation";
import { CounterPOS } from "@/components/admin/counter-pos";

/** Cash billing always uses the durable local outbox, online or offline.
 * Credit, approvals and non-cash workflows remain in the existing online desk. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ online?: string }>;
}) {
  const query = await searchParams;
  if (query.online !== "1") redirect("/offline-pos.html");
  return <CounterPOS />;
}

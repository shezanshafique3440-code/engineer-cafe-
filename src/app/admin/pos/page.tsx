import { CounterPOS } from "@/components/admin/counter-pos";
import { SaleCounter } from "@/components/admin/sale-counter";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ online?: string }>;
}) {
  const query = await searchParams;
  return query.online === "1" ? <CounterPOS /> : <SaleCounter />;
}

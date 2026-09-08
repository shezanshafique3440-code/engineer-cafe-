import type { Metadata } from "next";
import { CustomersManager } from "@/components/admin/customers-manager";

export const metadata: Metadata = { title: "Customers" };

export default function AdminCustomersPage() {
  return <CustomersManager />;
}

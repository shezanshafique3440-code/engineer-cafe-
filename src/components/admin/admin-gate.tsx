"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "./admin-shell";

/**
 * The login page renders bare; every other admin route gets the sidebar shell.
 * Access itself is enforced by middleware and by each server page/API route.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;
  return <AdminShell>{children}</AdminShell>;
}

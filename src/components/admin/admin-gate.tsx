"use client";

import { usePathname } from "next/navigation";
import { useSession } from "@/context/session-context";
import { can, PAGE_PERMISSIONS } from "@/lib/permissions";
import { AdminShell } from "./admin-shell";

/**
 * The login page renders bare; every other admin route gets the sidebar shell.
 * Access itself is enforced by middleware and by each server page/API route.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();
  if (pathname === "/admin/login") return <>{children}</>;
  const permission = PAGE_PERMISSIONS[pathname];
  if (!user || user.role === "CUSTOMER") return <div className="p-8"><h1>Staff sign-in required</h1><a href="/admin/login">Sign in</a></div>;
  return <AdminShell>{permission && !can(user, permission) ? <div className="surface p-6" role="alert"><h1 className="text-xl font-bold">Access not granted</h1><p>Your administrator can assign access to this module.</p><div className="mt-4 flex flex-wrap gap-3">{Object.entries(PAGE_PERMISSIONS).filter(([, p]) => can(user, p)).map(([href, p]) => <a className="underline" key={href} href={href}>{p}</a>)}</div></div> : children}</AdminShell>;
}

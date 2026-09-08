import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { AccountShell } from "@/components/account/account-shell";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // Middleware gates this too — this is the authoritative database check.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  return <AccountShell>{children}</AccountShell>;
}

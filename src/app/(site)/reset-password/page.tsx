import { PasswordRecovery } from "@/components/account/password-recovery";
export const metadata = {
  title: "Account recovery",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="container py-12">
      <PasswordRecovery token={params.token || "invalid"} />
    </div>
  );
}

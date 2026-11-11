import { PasswordRecovery } from "@/components/account/password-recovery";
export const metadata = {
  title: "Account recovery",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function RecoveryPage() {
  return (
    <div className="container py-12">
      <PasswordRecovery />
    </div>
  );
}

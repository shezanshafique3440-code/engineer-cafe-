import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth";
import { getSettings, publicSettings } from "@/server/settings";
import { SessionProvider } from "@/context/session-context";
import { SettingsProvider } from "@/context/settings-context";
import { AdminGate } from "@/components/admin/admin-gate";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Engineer Cafe Admin" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, settingsRow] = await Promise.all([getCurrentUser(), getSettings()]);

  return (
    <SettingsProvider settings={publicSettings(settingsRow)}>
      <SessionProvider initialUser={user}>
        <AdminGate>{children}</AdminGate>
      </SessionProvider>
    </SettingsProvider>
  );
}

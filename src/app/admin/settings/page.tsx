import type { Metadata } from "next";
import { SettingsManager } from "@/components/admin/settings-manager";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return <SettingsManager />;
}

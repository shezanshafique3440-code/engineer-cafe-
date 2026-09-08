import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { buildMetadata } from "@/lib/seo";
import { ProfileSettings } from "@/components/account/profile-settings";

export const metadata: Metadata = buildMetadata({
  title: "Account Settings",
  path: "/account/settings",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { phone: true },
  });

  return <ProfileSettings initialPhone={record?.phone ?? ""} />;
}

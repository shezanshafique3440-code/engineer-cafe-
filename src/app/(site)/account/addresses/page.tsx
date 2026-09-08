import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { buildMetadata } from "@/lib/seo";
import { AddressesView } from "@/components/account/addresses-view";

export const metadata: Metadata = buildMetadata({
  title: "Saved Addresses",
  path: "/account/addresses",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return <AddressesView initialAddresses={addresses} />;
}

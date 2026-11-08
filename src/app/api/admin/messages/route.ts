import { prisma } from "@/lib/prisma";
import { handle, json, requirePermission } from "@/server/api";

export const GET = handle(async () => {
  await requirePermission("moderation");
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return json({ messages });
});

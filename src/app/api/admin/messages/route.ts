import { prisma } from "@/lib/prisma";
import { handle, json, requireAdmin } from "@/server/api";

export const GET = handle(async () => {
  await requireAdmin();
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return json({ messages });
});

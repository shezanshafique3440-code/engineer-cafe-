import { prisma } from "@/lib/prisma";
import { handle, json, requireAdmin } from "@/server/api";

export const GET = handle(async () => {
  await requireAdmin();
  const groups = await prisma.addonGroup.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { addons: { orderBy: { sortOrder: "asc" } } },
  });
  return json({ groups });
});

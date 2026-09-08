import { prisma } from "@/lib/prisma";
import { settingsSchema } from "@/lib/validation";
import { handle, json, parseBody, requireAdmin } from "@/server/api";
import { getSettings } from "@/server/settings";

export const GET = handle(async () => {
  await requireAdmin();
  const settings = await getSettings();
  return json({ settings });
});

export const PUT = handle(async (request: Request) => {
  await requireAdmin();
  const data = await parseBody(request, settingsSchema);
  await getSettings(); // ensure the row exists

  const settings = await prisma.cafeSetting.update({
    where: { id: 1 },
    data: {
      ...data,
      logoUrl: data.logoUrl || null,
      instagramUrl: data.instagramUrl || null,
      facebookUrl: data.facebookUrl || null,
      tiktokUrl: data.tiktokUrl || null,
      freeDeliveryOver: data.freeDeliveryOver || null,
    },
  });
  return json({ settings });
});

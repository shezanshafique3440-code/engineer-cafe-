import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { settingsSchema } from "@/lib/validation";
import { handle, json, parseBody, requireAdmin, forbidden } from "@/server/api";
import { getSettings } from "@/server/settings";
import { resolveTheme } from "@/lib/themes";

export const GET = handle(async () => {
  await requireAdmin("settings");
  const settings = await getSettings();
  return json({ settings });
});

export const PUT = handle(async (request: Request) => {
  const user = await requireAdmin("settings");
  const data = await parseBody(request, settingsSchema);
  const current = await getSettings();
  if (user.role !== "ADMIN" && data.theme !== resolveTheme(current.theme))
    throw forbidden("Only an admin can change the website theme.");
  const { theme, ...otherSettings } = data;

  const settings = await prisma.cafeSetting.update({
    where: { id: 1 },
    data: {
      ...otherSettings,
      // Staff can save their operational settings without ever writing the
      // palette, including if an admin changes it concurrently.
      ...(user.role === "ADMIN" ? { theme } : {}),
      logoUrl: data.logoUrl || null,
      instagramUrl: data.instagramUrl || null,
      facebookUrl: data.facebookUrl || null,
      tiktokUrl: data.tiktokUrl || null,
      freeDeliveryOver: data.freeDeliveryOver ?? null,
    },
  });

  // Settings feed the root layout (theme, browser chrome) and every cached
  // page, so drop the whole tree rather than making the cafe wait out the
  // 60s revalidate window to see its own change.
  revalidatePath("/", "layout");

  return json({ settings });
});

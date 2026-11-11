import { revalidatePath } from "next/cache";
import { audit, businessTx } from "@/server/business/core";
import { settingsSchema } from "@/lib/validation";
import { handle, json, parseBody, requireAdmin, forbidden, badRequest } from "@/server/api";
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
  if (data.onlinePaymentEnabled) throw badRequest("Online card/wallet checkout requires a verified payment gateway. Use cash or counter payments until a provider is configured and tested.");
  const current = await getSettings();
  if (user.role !== "ADMIN" && data.theme !== resolveTheme(current.theme))
    throw forbidden("Only an admin can change the website theme.");
  const { theme, ...otherSettings } = data;

  const settings = await businessTx(async (tx) => {
    const before = await tx.cafeSetting.findUniqueOrThrow({ where: { id: 1 } });
    const updated = await tx.cafeSetting.update({
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

    const fields = [
      "cafeName",
      "taxPercent",
      "deliveryFee",
      "minOrderAmount",
      "isAcceptingOrders",
      "theme",
      "logoUrl",
      "codEnabled",
      "cashAtCounterEnabled",
      "onlinePaymentEnabled",
    ] as const;
    const changes = fields
      .filter((key) => before[key] !== updated[key])
      .map((key) => ({ field: key, before: before[key], after: updated[key] }));
    if (changes.length)
      await audit(tx, user, "UPDATE_CAFE_SETTINGS", "CafeSetting", "1", {
        changes,
      });
    return updated;
  });
  // Settings feed the root layout (theme, browser chrome) and every cached
  // page, so drop the whole tree rather than making the cafe wait out the
  // 60s revalidate window to see its own change.
  revalidatePath("/", "layout");

  return json({ settings });
});

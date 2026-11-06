import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json, parseBody, requireAdmin, forbidden } from "@/server/api";
import { getSettings } from "@/server/settings";
export const GET = handle(async () => {
  await requireAdmin();
  return json({ settings: await getSettings() });
});
export const PUT = handle(async (request: Request) => {
  const user = await requireAdmin();
  if (user.role !== "ADMIN") throw forbidden();
  const data = await parseBody(
    request,
    z.object({
      loyaltyEnabled: z.boolean(),
      loyaltyEarnEvery: z.number().int().min(1).max(10000),
      loyaltyRewardPoints: z.number().int().min(1).max(100000),
      loyaltyRewardValue: z.number().int().min(1).max(10000),
      schedulingEnabled: z.boolean(),
      scheduleLeadMinutes: z.number().int().min(15).max(1440),
      scheduleDaysAhead: z.number().int().min(1).max(30),
      scheduleOpenMinute: z.number().int().min(0).max(1439),
      scheduleCloseMinute: z.number().int().min(0).max(1439),
    }),
  );
  const settings = await prisma.cafeSetting.update({ where: { id: 1 }, data });
  revalidatePath("/", "layout");
  return json({ settings });
});

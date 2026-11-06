import { prisma } from "@/lib/prisma";
import { handle, json, requireUser } from "@/server/api";
import { loyaltyBalance } from "@/server/loyalty";
import { getSettings } from "@/server/settings";
export const GET = handle(async () => {
  const user = await requireUser();
  const [balance, entries, settings] = await Promise.all([
    loyaltyBalance(prisma, user.id),
    prisma.loyaltyEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    getSettings(),
  ]);
  return json({
    balance,
    entries,
    enabled: settings.loyaltyEnabled,
    earnEvery: settings.loyaltyEarnEvery,
    rewardPoints: settings.loyaltyRewardPoints,
    rewardValue: settings.loyaltyRewardValue,
  });
});

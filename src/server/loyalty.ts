import "server-only";
import type { Prisma, Order } from "@prisma/client";
export async function loyaltyBalance(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const result = await tx.loyaltyEntry.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}
export async function settleLoyalty(
  tx: Prisma.TransactionClient,
  order: Pick<
    Order,
    "id" | "userId" | "loyaltyPointsEarned" | "loyaltyPointsUsed"
  >,
  cancelled: boolean,
) {
  if (!order.userId) return;
  // Per-user serialization also protects redemption against a concurrent reversal.
  const active = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "User" WHERE id = ${order.userId} FOR UPDATE`;
  if (!active.length) return;
  const add = (kind: string, points: number) =>
    tx.loyaltyEntry.createMany({
      data: [{ userId: order.userId!, orderKey: order.id, kind, points }],
      skipDuplicates: true,
    });
  if (!cancelled) {
    if (order.loyaltyPointsEarned) await add("EARN", order.loyaltyPointsEarned);
    return;
  }
  if (order.loyaltyPointsUsed) await add("RETURN", order.loyaltyPointsUsed);
  const earned = await tx.loyaltyEntry.findUnique({
    where: { orderKey_kind: { orderKey: order.id, kind: "EARN" } },
  });
  if (earned) await add("REVERSE", -earned.points);
}

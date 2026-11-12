import { handle, json, requireUser, forbidden } from "@/server/api";
import { prisma } from "@/lib/prisma";
import { canBusiness } from "@/lib/business-access";
export const dynamic = "force-dynamic";
/** Small, read-only counter probe. Never return another cashier's shift. */
export const GET = handle(async () => {
  const actor = await requireUser();
  if (!canBusiness(actor, "pos") && !canBusiness(actor, "cash"))
    throw forbidden("Counter access is required.");
  const [config, shift] = await Promise.all([
    prisma.businessConfig.findUnique({
      where: { id: 1 },
      select: { enabled: true },
    }),
    prisma.cashShift.findFirst({
      where: {
        openedById: actor.id,
        closedAt: null,
        drawer: { isActive: true, account: { isActive: true } },
      },
      orderBy: { openedAt: "desc" },
      select: { id: true, openedAt: true, drawer: { select: { name: true } } },
    }),
  ]);
  const response = json({
    actorId: actor.id,
    enabled: Boolean(config?.enabled),
    shift,
    checkedAt: new Date().toISOString(),
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});

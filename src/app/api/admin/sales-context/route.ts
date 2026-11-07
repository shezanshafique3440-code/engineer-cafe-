import { prisma } from "@/lib/prisma";
import { handle, json, requireAdmin, forbidden } from "@/server/api";
import { canBusiness } from "@/lib/business-access";
export const GET = handle(async () => {
  const actor = await requireAdmin("orders");
  if (!canBusiness(actor, "pos") && !canBusiness(actor, "table-orders"))
    throw forbidden();
  const [config, accounts, sessions, customers, shift] = await Promise.all([
    prisma.businessConfig.findUnique({ where: { id: 1 } }),
    prisma.businessAccount.findMany({
      where: { isMoney: true, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        drawer: { select: { id: true } },
      },
    }),
    prisma.tableSession.findMany({
      where: {
        closedAt: null,
        ...(actor.businessProfile === "WAITER"
          ? { waiterId: actor.employeeId ?? "unassigned" }
          : {}),
      },
      include: { table: { select: { name: true } } },
    }),
    prisma.businessParty.findMany({
      where: { kind: "CUSTOMER", isActive: true, creditLimit: { gt: 0 } },
      select: { id: true, name: true, creditLimit: true },
    }),
    prisma.cashShift.findFirst({
      where: { openedById: actor.id, closedAt: null },
      include: { drawer: { select: { name: true, accountId: true } } },
    }),
  ]);
  return json({
    enabled: Boolean(config?.enabled),
    accounts: canBusiness(actor, "payments") ? accounts : [],
    sessions,
    customers: canBusiness(actor, "payments") ? customers : [],
    shift: canBusiness(actor, "payments") ? shift : null,
  });
});

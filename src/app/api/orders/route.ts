import { checkoutSchema } from "@/lib/validation";
import { handle, json, parseBody, requireUser } from "@/server/api";
import { getCurrentUser } from "@/server/auth";
import { createCafeOrder } from "@/server/checkout";
import { getSettings } from "@/server/settings";
import { serializeOrder } from "@/server/orders";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/server/rate-limit";

/** Orders belonging to the signed-in customer. */
export const GET = handle(async () => {
  const user = await requireUser();
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      items: { include: { addons: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  return json({ orders: orders.map(serializeOrder) });
});

/**
 * Creates an order. Every monetary figure is recalculated here from the
 * database — the client's totals are ignored entirely.
 */
export const POST = handle(async (request: Request) => {
  rateLimit(request, "checkout", 10, 60_000);
  const data = await parseBody(request, checkoutSchema);
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  const order = await createCafeOrder(data, user, settings);

  return json({ order: serializeOrder(order) }, 201);
});

export const dynamic = "force-dynamic";

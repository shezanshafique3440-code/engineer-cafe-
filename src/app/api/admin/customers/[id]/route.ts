import { z } from "zod";
import { businessTransaction } from "@/server/transaction";
import { prisma } from "@/lib/prisma";
import {
  handle,
  json,
  parseBody,
  requireAdmin,
  requirePermission,
  badRequest,
} from "@/server/api";

const schema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(["CUSTOMER", "STAFF", "ADMIN"]).optional(),
});

export const PATCH = handle(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = await parseBody(request, schema);

    if (id === admin.id)
      throw badRequest("You can't change your own role or status.");

    const user = await businessTransaction(async (tx) => {
      // Never leave the cafe without an admin who can log in.
      if (data.isActive === false || (data.role && data.role !== "ADMIN")) {
        const target = await tx.user.findUnique({
          where: { id },
          select: { role: true },
        });
        if (target?.role === "ADMIN") {
          const admins = await tx.user.count({
            where: { role: "ADMIN", isActive: true },
          });
          if (admins <= 1)
            throw badRequest("At least one active admin must remain.");
        }
      }

      return tx.user.update({
        where: { id },
        data: {
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.role ? { role: data.role } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      });
    });
    return json({ user });
  },
);

export const GET = handle(
  async (_r: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requirePermission("customers");
    const { id } = await ctx.params;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        addresses: true,
        orders: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
          },
        },
      },
    });
    return json({ customer: user });
  },
);

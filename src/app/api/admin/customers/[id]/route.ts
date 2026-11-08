import { businessLock } from "@/server/business/core";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  handle,
  json,
  parseBody,
  requireAdmin,
  badRequest,
  forbidden,
  notFound,
  HttpError,
} from "@/server/api";
import { refreshProductRating } from "@/server/products";

const schema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(["CUSTOMER", "STAFF", "ADMIN"]).optional(),
});

export const PATCH = handle(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin("customers");
    if (admin.role !== "ADMIN")
      throw forbidden("Only an admin can manage customer accounts.");
    const { id } = await ctx.params;
    const data = await parseBody(request, schema);

    if (id === admin.id)
      throw badRequest("You can't change your own role or status.");

    const user = await prisma.$transaction(async (tx) => {
      await businessLock(tx);
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
          updatedAt: true,
        },
      });
    });
    return json({ user: { ...user, version: user.updatedAt.toISOString() } });
  },
);

const deleteSchema = z.object({
  email: z.string().trim().email().max(254),
  version: z.string().datetime(),
});

export const DELETE = handle(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin("customers");
    if (admin.role !== "ADMIN")
      throw forbidden("Only an admin can delete customer accounts.");
    const { id } = await ctx.params;
    if (id === admin.id) throw badRequest("You can't delete your own account.");
    const confirmation = await parseBody(request, deleteSchema);

    await prisma.$transaction(async (tx) => {
      await businessLock(tx);
      const customer = await tx.user.findUnique({
        where: { id },
        select: {
          email: true,
          role: true,
          updatedAt: true,
          reviews: { select: { productId: true } },
        },
      });
      if (!customer)
        throw notFound("Customer no longer exists. Refresh the list.");
      if (customer.role !== "CUSTOMER")
        throw forbidden("Staff and admin accounts cannot be deleted here.");
      if (
        customer.email !== confirmation.email ||
        customer.updatedAt.toISOString() !== confirmation.version
      )
        throw new HttpError(
          409,
          "This customer changed on another screen. Refresh and review before deleting.",
        );
      const removed = await tx.user.deleteMany({
        where: {
          id,
          role: "CUSTOMER",
          email: confirmation.email,
          updatedAt: customer.updatedAt,
        },
      });
      if (removed.count !== 1)
        throw new HttpError(
          409,
          "This customer changed on another screen. Refresh and try again.",
        );
      // User-owned addresses, favourites and reviews cascade; historical orders
      // retain their contents and contact snapshot with a null account link.
      for (const productId of new Set(
        customer.reviews.map((review) => review.productId),
      ))
        await refreshProductRating(productId, tx);
    });
    return json({
      ok: true,
      id,
      message: "Customer deleted. Previous orders were kept.",
    });
  },
);

export const GET = handle(
  async (_r: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireAdmin("customers");
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

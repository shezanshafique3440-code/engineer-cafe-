import { prisma } from "@/lib/prisma";
import { reviewSchema } from "@/lib/validation";
import { handle, json, notFound, parseBody, requireUser, HttpError } from "@/server/api";
import { refreshProductRating } from "@/server/products";
import { rateLimit } from "@/server/rate-limit";

export const GET = handle(
  async (_request: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) throw notFound();

    const reviews = await prisma.review.findMany({
      where: { productId: product.id, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });

    return json({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        author: r.user.name,
      })),
    });
  },
);

export const POST = handle(
  async (request: Request, ctx: { params: Promise<{ slug: string }> }) => {
    rateLimit(request, "review", 8, 60_000);
    const user = await requireUser();
    const { slug } = await ctx.params;

    const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) throw notFound();

    const data = await parseBody(request, reviewSchema.omit({ productId: true }));

    // Only customers who actually received this item may review it.
    const purchased = await prisma.orderItem.findFirst({
      where: { productId: product.id, order: { userId: user.id, status: "DELIVERED" } },
      select: { id: true },
    });
    if (!purchased) {
      throw new HttpError(403, "You can review an item once you've received it in an order.");
    }

    await prisma.review.upsert({
      where: { productId_userId: { productId: product.id, userId: user.id } },
      update: { rating: data.rating, comment: data.comment, status: "PENDING" },
      create: {
        productId: product.id,
        userId: user.id,
        rating: data.rating,
        comment: data.comment,
        status: "PENDING",
      },
    });
    await refreshProductRating(product.id);

    return json({ ok: true, message: "Thanks! Your review will appear once approved." }, 201);
  },
);

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json, parseQuery, requireAdmin } from "@/server/api";

const querySchema = z.object({
  status: z.enum(["ALL", "PENDING", "APPROVED", "HIDDEN"]).default("ALL"),
});

export const GET = handle(async (request: Request) => {
  await requireAdmin();
  const q = parseQuery(request, querySchema);
  const reviews = await prisma.review.findMany({
    where: q.status === "ALL" ? {} : { status: q.status },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { name: true, slug: true } },
    },
  });
  return json({
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      author: r.user.name,
      authorEmail: r.user.email,
      productName: r.product.name,
      productSlug: r.product.slug,
    })),
  });
});

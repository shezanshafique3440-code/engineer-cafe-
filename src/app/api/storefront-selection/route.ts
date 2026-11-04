import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/server/api";
import { productSelect, toProductDTO } from "@/server/products";
export const GET = handle(async (request: Request) => {
  const slugs = z
    .array(z.string().regex(/^[a-z0-9-]{1,150}$/))
    .max(12)
    .parse(new URL(request.url).searchParams.getAll("slug"));
  if (!slugs.length) return json({ products: [] });
  const rows = await prisma.product.findMany({
    where: {
      slug: { in: [...new Set(slugs)] },
      isAvailable: true,
      category: { isActive: true },
    },
    select: productSelect,
  });
  const bySlug = new Map(rows.map((row) => [row.slug, toProductDTO(row)]));
  return json({
    products: [...new Set(slugs)].flatMap((slug) =>
      bySlug.has(slug) ? [bySlug.get(slug)!] : [],
    ),
  });
});

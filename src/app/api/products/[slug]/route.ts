import { handle, json, notFound } from "@/server/api";
import { getProductBySlug } from "@/server/products";

export const GET = handle(
  async (_request: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const product = await getProductBySlug(slug);
    if (!product) throw notFound("This product is no longer on the menu.");
    return json({ product });
  },
);

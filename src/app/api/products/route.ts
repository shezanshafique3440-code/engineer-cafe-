import { z } from "zod";
import { handle, json, parseQuery } from "@/server/api";
import { listProducts, type ProductSort } from "@/server/products";

const booleanish = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const querySchema = z.object({
  category: z.string().max(60).optional(),
  search: z.string().max(80).optional(),
  minPrice: z.coerce.number().min(0).max(1_000_000).optional(),
  maxPrice: z.coerce.number().min(0).max(1_000_000).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  vegetarian: booleanish,
  popular: booleanish,
  featured: booleanish,
  spicy: booleanish,
  sort: z.enum(["popular", "price-asc", "price-desc", "rating", "newest", "name"]).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  perPage: z.coerce.number().int().min(1).max(60).optional(),
});

export const GET = handle(async (request: Request) => {
  const query = parseQuery(request, querySchema);
  const result = await listProducts({ ...query, sort: query.sort as ProductSort });
  return json(result);
});

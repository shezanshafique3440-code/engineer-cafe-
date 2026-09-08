import { handle, json } from "@/server/api";
import { listCategories } from "@/server/products";

export const GET = handle(async () => {
  const categories = await listCategories();
  return json({ categories });
});

import { getMealCatalog } from "@/server/products";
import { handle, json, badRequest } from "@/server/api";
export const GET = handle(async () => {
  const catalog = await getMealCatalog(2000);
  if (catalog.truncated) throw badRequest("The menu exceeds 2000 available products. Archive unused products before loading the counter.");
  return json(catalog);
});

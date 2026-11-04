import { getMealCatalog } from "@/server/products";
import { handle, json } from "@/server/api";
export const GET = handle(async () => json(await getMealCatalog()));

import { handle, json, requirePermission, badRequest } from "@/server/api";
import {
  MODULE_PERMISSIONS,
  mutateOperations,
  readOperations,
} from "@/server/operations";

export const dynamic = "force-dynamic";
export const GET = handle(
  async (request: Request, ctx: { params: Promise<{ module: string }> }) => {
    const { module } = await ctx.params;
    const permission = MODULE_PERMISSIONS[module];
    if (!permission) throw badRequest("Unknown module.");
    const user = await requirePermission(permission);
    const response = json(
      await readOperations(module, user, new URL(request.url)),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  },
);
export const POST = handle(
  async (request: Request, ctx: { params: Promise<{ module: string }> }) => {
    const { module } = await ctx.params;
    const permission = MODULE_PERMISSIONS[module];
    if (!permission) throw badRequest("Unknown module.");
    const user = await requirePermission(permission);
    return json(
      await mutateOperations(
        module,
        await request.json().catch(() => {
          throw badRequest("Invalid JSON.");
        }),
        user,
      ),
    );
  },
);

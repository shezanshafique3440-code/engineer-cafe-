import { handle, json } from "@/server/api";
import { clearSessionCookie } from "@/server/auth";

export const POST = handle(async () => {
  await clearSessionCookie();
  return json({ ok: true });
});

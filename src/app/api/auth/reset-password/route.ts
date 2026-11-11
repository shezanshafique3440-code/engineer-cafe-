import { z } from "zod";
import { handle, json, parseBody } from "@/server/api";
import { passwordSchema } from "@/lib/validation";
import { rateLimit } from "@/server/rate-limit";
import { resetPassword } from "@/server/password-reset";
export const POST = handle(async (request: Request) => {
  rateLimit(request, "password-reset-use", 10, 15 * 60_000);
  const data = await parseBody(
    request,
    z.object({
      token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      password: passwordSchema,
    }),
  );
  await resetPassword(data.token, data.password);
  return json({
    message:
      "Password changed. Sign in with your new password; previous sessions have been signed out.",
  });
});

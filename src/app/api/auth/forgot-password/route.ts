import { z } from "zod";
import { handle, json, parseBody } from "@/server/api";
import { rateLimit } from "@/server/rate-limit";
import { requestPasswordReset } from "@/server/password-reset";
export const POST = handle(async (request: Request) => {
  rateLimit(request, "password-reset-request", 5, 15 * 60_000);
  const { email } = await parseBody(
    request,
    z.object({
      email: z
        .string()
        .trim()
        .email()
        .max(254)
        .transform((s) => s.toLowerCase()),
    }),
  );
  await requestPasswordReset(email);
  return json({
    message:
      "If this active account exists, a private reset link has been requested. Check your inbox or contact the owner if it does not arrive.",
  });
});

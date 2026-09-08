import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { handle, json, parseBody, HttpError } from "@/server/api";
import { setSessionCookie, verifyPassword } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";

export const POST = handle(async (request: Request) => {
  rateLimit(request, "login", 10, 60_000);
  const data = await parseBody(request, loginSchema);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  // Same message for unknown email and wrong password — no account enumeration.
  const invalid = new HttpError(401, "Incorrect email or password.");
  if (!user || !user.isActive) throw invalid;
  if (!(await verifyPassword(data.password, user.passwordHash))) throw invalid;

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const session = { id: user.id, name: user.name, email: user.email, role: user.role };
  await setSessionCookie(session);
  return json({ user: session });
});

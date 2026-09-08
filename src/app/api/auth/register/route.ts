import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { handle, json, parseBody, HttpError } from "@/server/api";
import { hashPassword, setSessionCookie } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";

export const POST = handle(async (request: Request) => {
  rateLimit(request, "register", 5, 60_000);
  const data = await parseBody(request, registerSchema);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists.", {
      email: ["An account with this email already exists."],
    });
  }

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      passwordHash: await hashPassword(data.password),
      role: "CUSTOMER",
    },
    select: { id: true, name: true, email: true, role: true },
  });

  await setSessionCookie(user);
  return json({ user }, 201);
});

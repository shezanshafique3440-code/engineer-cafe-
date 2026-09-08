import { prisma } from "@/lib/prisma";
import { profileSchema, passwordChangeSchema } from "@/lib/validation";
import { handle, json, parseBody, requireUser, HttpError } from "@/server/api";
import { getCurrentUser, hashPassword, setSessionCookie, verifyPassword } from "@/server/auth";

export const GET = handle(async () => {
  const user = await getCurrentUser();
  return json({ user });
});

export const PATCH = handle(async (request: Request) => {
  const session = await requireUser();
  const body = (await request.clone().json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body.currentPassword === "string") {
    const data = await parseBody(request, passwordChangeSchema);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
    if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
      throw new HttpError(400, "Your current password is incorrect.", {
        currentPassword: ["Your current password is incorrect."],
      });
    }
    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash: await hashPassword(data.newPassword) },
    });
    return json({ ok: true });
  }

  const data = await parseBody(request, profileSchema);
  const user = await prisma.user.update({
    where: { id: session.id },
    data: { name: data.name, phone: data.phone || null },
    select: { id: true, name: true, email: true, role: true },
  });
  await setSessionCookie(user);
  return json({ user });
});

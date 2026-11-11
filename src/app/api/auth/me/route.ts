import { readJsonBody } from "@/server/api";
import { prisma } from "@/lib/prisma";
import { profileSchema, passwordChangeSchema } from "@/lib/validation";
import { handle, json, requireUser, badRequest, HttpError } from "@/server/api";
import {
  getCurrentUser,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "@/server/auth";

export const GET = handle(async () => {
  const user = await getCurrentUser();
  return json({ user });
});

export const PATCH = handle(async (request: Request) => {
  const session = await requireUser();
  const raw = await readJsonBody(request);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw badRequest("Invalid request body.");
  const body = raw as Record<string, unknown>;

  if (typeof body.currentPassword === "string") {
    const data = passwordChangeSchema.parse(body);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.id },
    });
    if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
      throw new HttpError(400, "Your current password is incorrect.", {
        currentPassword: ["Your current password is incorrect."],
      });
    }
    const changed = await prisma.user.updateMany({
      where: {
        id: session.id,
        passwordHash: user.passwordHash,
        sessionVersion: session.sessionVersion ?? 0,
        isActive: true,
      },
      data: {
        passwordHash: await hashPassword(data.newPassword),
        sessionVersion: { increment: 1 },
      },
    });
    if (changed.count !== 1)
      throw new HttpError(
        409,
        "Your account changed. Sign in again before changing the password.",
      );
    await setSessionCookie(session);
    return json({ ok: true });
  }

  const data = profileSchema.parse(body);
  const user = await prisma.user.update({
    where: { id: session.id },
    data: { name: data.name, phone: data.phone || null },
    select: { id: true, name: true, email: true, role: true },
  });
  await setSessionCookie(user);
  return json({ user });
});

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { hashPassword } from "./auth";
import { badRequest, HttpError } from "./api";
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function requestPasswordReset(email: string) {
  if (!process.env.RESEND_API_KEY || !process.env.RESET_EMAIL_FROM)
    throw new HttpError(
      503,
      "Email recovery is not configured. Contact the cafe owner for help.",
    );
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });
  if (!user?.isActive) return;
  const token = randomBytes(32).toString("base64url");
  const reset = await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  const url = new URL("/reset-password", env.siteUrl);
  url.searchParams.set("token", token);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESET_EMAIL_FROM,
        to: [email],
        subject: "Reset your cafe account password",
        text: `Use this private link within 30 minutes to reset your password:\n${url}\nIf you did not request this, ignore this email.`,
      }),
    });
    if (!response.ok) throw Error("Email delivery unavailable");
  } catch {
    await prisma.passwordReset.deleteMany({ where: { id: reset.id } });
    // Keep the same public result for registered and unknown addresses.
    console.error(
      "[password-reset] Delivery failed; check mail-provider configuration.",
    );
  }
}
export async function resetPassword(token: string, password: string) {
  const hash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const reset = await tx.passwordReset.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date())
      throw badRequest(
        "This reset link is invalid or expired. Request a new one.",
      );
    const claimed = await tx.passwordReset.updateMany({
      where: {
        id: reset.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        user: { isActive: true },
      },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1)
      throw badRequest(
        "This reset link is invalid or expired. Request a new one.",
      );
    await tx.user.update({
      where: { id: reset.userId },
      data: { passwordHash: hash, sessionVersion: { increment: 1 } },
    });
    await tx.passwordReset.updateMany({
      where: { userId: reset.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  });
}

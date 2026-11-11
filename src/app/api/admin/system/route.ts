import { readFile } from "node:fs/promises";
import path from "node:path";
import { handle, json, requireAdmin, forbidden } from "@/server/api";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const user = await requireAdmin();
  if (user.role !== "ADMIN")
    throw forbidden("Only an owner can view system health.");
  const since = new Date(Date.now() - 30 * 60_000);
  const [notificationFailures, demoFailures] = await Promise.all([
    prisma.notificationJob.count({
      where: {
        deliveredAt: null,
        OR: [{ attempts: { gte: 6 } }, { createdAt: { lt: since } }],
      },
    }),
    prisma.demoJob.count({ where: { status: "FAILED" } }),
  ]);
  let backup: { completedAt: string; offsite: boolean } | null = null;
  try {
    const value = JSON.parse(
      await readFile(
        path.join(
          process.env.CAFE_BACKUP_ROOT || "/var/backups/engineer-cafe",
          "last-success.json",
        ),
        "utf8",
      ),
    );
    if (
      typeof value.completedAt === "string" &&
      Number.isFinite(Date.parse(value.completedAt))
    )
      backup = {
        completedAt: value.completedAt,
        offsite: value.offsite === true,
      };
  } catch {
    /* Unknown is displayed explicitly, never assumed successful. */
  }
  return json({
    database: "Connected",
    notificationFailures,
    demoFailures,
    backup,
    emailRecovery: Boolean(
      process.env.RESEND_API_KEY && process.env.RESET_EMAIL_FROM,
    ),
    onlineGateway: "Not configured",
    checkedAt: new Date().toISOString(),
  });
});

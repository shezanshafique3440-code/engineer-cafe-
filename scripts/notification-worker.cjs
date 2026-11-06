// Dedicated PM2 worker: durable jobs, bounded retries, disabled accounts excluded.
const { PrismaClient } = require("@prisma/client");
const webpush = require("web-push");
const db = new PrismaClient();
const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv } = process.env;
if (!pub || !priv) {
  console.error("VAPID keys missing");
  process.exit(1);
}
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "https://esellerstore.vip",
  pub,
  priv,
);
let stopping = false;
async function tick() {
  // Lock jobs across worker restarts/overlaps; failed sends retry per subscription.
  const jobs =
    await db.$queryRaw`UPDATE "NotificationJob" SET "availableAt"=NOW()+INTERVAL '2 minutes', "attempts"="attempts"+1 WHERE id IN (SELECT id FROM "NotificationJob" WHERE "deliveredAt" IS NULL AND "availableAt"<=NOW() AND "attempts"<6 ORDER BY "createdAt" LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING *`;
  for (const job of jobs) {
    const subscriptions = await db.pushSubscription.findMany({
      where: {
        createdAt: { lte: job.createdAt },
        user: { isActive: true, role: { in: ["ADMIN", "STAFF"] } },
      },
    });
    const results = await Promise.allSettled(
      subscriptions.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({
              title: job.title,
              body: job.body,
              url: job.url,
              tag: job.eventKey,
            }),
            { TTL: 1800, timeout: 10000 },
          );
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            await db.pushSubscription.deleteMany({ where: { id: s.id } });
            return;
          }
          throw e;
        }
      }),
    );
    const failed = results.some((r) => r.status === "rejected");
    await db.notificationJob.update({
      where: { id: job.id },
      data: failed
        ? {
            availableAt: new Date(
              Date.now() + Math.min(3600000, 15000 * 2 ** job.attempts),
            ),
          }
        : { deliveredAt: new Date() },
    });
  }
  await db.notificationJob.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 7 * 86400000) } },
  });
}
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
module.exports = { tick };
if (require.main === module)
  (async () => {
    while (!stopping) {
      try {
        await tick();
      } catch {
        console.error("Notification queue unavailable; retrying.");
      }
      await new Promise((r) => setTimeout(r, 10000));
    }
    await db.$disconnect();
  })();

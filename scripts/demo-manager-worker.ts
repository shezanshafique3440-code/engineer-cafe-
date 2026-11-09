import { prisma } from "@/lib/prisma";
import type { DB } from "@/server/business/core";
import { businessLock } from "@/server/business/core";
import {
  planCleanup,
  snapshot,
  rowId,
  q,
  DEMO_BATCH,
} from "@/server/demo-data";
import { seedBusinessDemo } from "./business-demo-data";
import { createRequire } from "node:module";
const { backupDatabase } = createRequire(import.meta.url)(
  "./demo-backup.cjs",
) as { backupDatabase: (id: string) => { path: string; hash: string } };
const tables = async (tx: DB) =>
  (
    await tx.$queryRaw<
      { name: string }[]
    >`SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'Demo%' AND tablename <> '_prisma_migrations' ORDER BY tablename`
  ).map((t) => t.name);
async function barrier(tx: DB) {
  await tx.$executeRawUnsafe(
    `LOCK TABLE ${(await tables(tx)).map(q).join(",")} IN SHARE ROW EXCLUSIVE MODE`,
  );
}
export async function resetDemo(jobId: string, expected: string) {
  return prisma.$transaction(
    async (tx) => {
      await businessLock(tx);
      await tx.$queryRaw`SELECT set_config('cafe.demo_job',${jobId},true)`;
      await barrier(tx);
      const plan = await planCleanup(tx);
      if (plan.preview.hash !== expected)
        throw Error(
          "Data changed since the preview. Nothing was deleted. Refresh the preview.",
        );
      if (plan.preview.blockers.length)
        throw Error(
          "Mixed demo and preserved records need review. Nothing was deleted.",
        );
      const owned = (table: string, id: string) =>
        plan.owned.has(table + ":" + id);
      const converted = new Map<string, string>();
      for (const c of plan.conversions) {
        let ingredientId = converted.get(c.ingredientId);
        if (!ingredientId) {
          const original = await tx.ingredient.findUnique({
            where: { name: c.name },
          });
          if (original && original.unit !== c.unit)
            throw Error("Ingredient units changed. Nothing was deleted.");
          ingredientId =
            original?.id ??
            (
              await tx.ingredient.create({
                data: {
                  name: c.name,
                  unit: c.unit,
                  quantity: 0,
                  stockValue: 0,
                },
              })
            ).id;
          converted.set(c.ingredientId, ingredientId);
        }
        await tx.recipeLine.update({
          where: { id: c.lineId },
          data: { ingredientId },
        });
      }
      for (const recipeId of new Set(plan.conversions.map((c) => c.recipeId)))
        await tx.recipe.update({
          where: { id: recipeId },
          data: {
            reviewRequired: true,
            note: "REVIEW REQUIRED: quantities are assumed practice values. Confirm the real cafe recipe before preparing food.",
          },
        });
      // Compare every preserved row after the explicit, reviewed recipe conversion.
      const protectedState = await snapshot(tx);
      const idsByTable = new Map<string, string[]>();
      for (const [table, entries] of plan.state.tables) {
        const ids = entries
          .filter((r) => owned(table, rowId(table, r.data)))
          .map((r) => rowId(table, r.data));
        if (!ids.length) continue;
        idsByTable.set(table, ids);
        if (table !== "BusinessRequest" && table !== "AddonGroupOnProduct") {
          await tx.$executeRawUnsafe(
            `INSERT INTO "DemoDeletePermit" ("jobId","tableName","recordId",fingerprint) SELECT $1,$2,t.id::text,md5(to_jsonb(t)::text) FROM ${q(table)} t JOIN unnest($3::text[]) demo_id(id) ON t.id::text=demo_id.id`,
            jobId,
            table,
            ids,
          );
        }
      }
      // Populate planner statistics before per-row immutable-delete guards read
      // this freshly populated permit table. Otherwise PostgreSQL may repeatedly
      // choose a sequential scan based on the table's previous empty statistics.
      await tx.$executeRawUnsafe('ANALYZE "DemoDeletePermit"');
      // Children before parents, derived from actual database constraints. Unknown
      // incoming references already block preview, even for cascading foreign keys.
      const remaining = new Set(idsByTable.keys());
      const order: string[] = [];
      while (remaining.size) {
        const leaves = [...remaining].filter(
          (t) =>
            !plan.state.fks.some(
              (f) => f.parent === t && f.child !== t && remaining.has(f.child),
            ),
        );
        if (!leaves.length)
          throw Error("Unexpected dependency cycle. Nothing was deleted.");
        order.push(...leaves.sort());
        leaves.forEach((t) => remaining.delete(t));
      }
      for (const table of order) {
        const ids = idsByTable.get(table)!;
        if (table === "AddonGroupOnProduct") {
          for (const id of ids) {
            const [product, group] = JSON.parse(id);
            await tx.$executeRaw`DELETE FROM "AddonGroupOnProduct" WHERE "productId"=${product} AND "addonGroupId"=${group}`;
          }
        } else {
          const column = table === "BusinessRequest" ? "key" : "id";
          if (table === "BusinessJournal")
            await tx.$executeRawUnsafe(
              `DELETE FROM "BusinessJournal" t USING unnest($1::text[]) demo_id(id) WHERE t."reversalOfId" IS NOT NULL AND t.id=demo_id.id`,
              ids,
            );
          await tx.$executeRawUnsafe(
            `DELETE FROM ${q(table)} t USING unnest($1::text[]) demo_id(id) WHERE t.${q(column)}::text=demo_id.id`,
            ids,
          );
        }
      }
      const after = await snapshot(tx);
      for (const [table, entries] of protectedState.tables) {
        const expected = entries
          .filter((r) => !owned(table, rowId(table, r.data)))
          .map((r) => rowId(table, r.data) + ":" + r.fingerprint)
          .sort();
        const actual = (after.tables.get(table) ?? [])
          .map((r) => rowId(table, r.data) + ":" + r.fingerprint)
          .sort();
        if (JSON.stringify(expected) !== JSON.stringify(actual))
          throw Error(
            "Preserved records changed unexpectedly. Reset was rolled back.",
          );
      }
      const bad = await tx.$queryRaw<
        { id: string }[]
      >`SELECT j.id FROM "BusinessJournal" j LEFT JOIN "BusinessPosting" p ON p."journalId"=j.id GROUP BY j.id HAVING count(p.id)<2 OR sum(p.debit-p.credit)<>0 LIMIT 1`;
      if (bad.length)
        throw Error("Ledger reconciliation failed. Reset was rolled back.");
      const job = await tx.demoJob.findUniqueOrThrow({ where: { id: jobId } });
      const result = {
        removed: plan.preview.counts,
        recipesToReview: plan.preview.recipesToReview,
        cleanIngredients: converted.size,
        previewHash: expected,
      };
      await tx.businessAudit.create({
        data: {
          actorId: job.actorId,
          actorName: job.actorName,
          action: "RESET_DEMO_DATA",
          entity: "DemoJob",
          entityId: jobId,
          details: result,
        },
      });
      await tx.demoRecord.deleteMany();
      await tx.demoDeletePermit.deleteMany({ where: { jobId } });
      await tx.demoJob.update({
        where: { id: jobId },
        data: { status: "DONE", finishedAt: new Date(), result },
      });
      await tx.demoControl.update({
        where: { id: 1 },
        data: { maintenanceJob: null },
      });
      return result;
    },
    { timeout: 1800000, maxWait: 10000 },
  );
}
export async function tick() {
  // Transaction-scoped worker mutex survives neither disconnect nor process death.
  return prisma.$transaction(
    async (lock) => {
      const [{ locked }] = await lock.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(73190423) AS locked`;
      if (!locked) return;
      const job = await prisma.demoJob.findFirst({
        where: { status: { in: ["QUEUED", "RUNNING"] } },
        orderBy: { createdAt: "asc" },
      });
      if (!job) return;
      try {
        const db = (
          await prisma.$queryRaw<
            { name: string }[]
          >`SELECT current_database() AS name`
        )[0]?.name;
        if (!["engineer_cafe", "cafe_demo_cleanup_test"].includes(db))
          throw Error("Unexpected database. Demo preparation stopped.");
        await prisma.$transaction(
          async (tx) => {
            await businessLock(tx);
            await barrier(tx);
            const current = await tx.demoControl.findUniqueOrThrow({
              where: { id: 1 },
            });
            if (current.maintenanceJob && current.maintenanceJob !== job.id)
              throw Error("Another maintenance job owns the database.");
            await tx.demoJob.update({
              where: { id: job.id },
              data: {
                status: "RUNNING",
                startedAt: job.startedAt ?? new Date(),
                error: null,
              },
            });
            await tx.demoControl.update({
              where: { id: 1 },
              data: { maintenanceJob: job.id },
            });
          },
          { timeout: 90000 },
        );
        const backup = backupDatabase(job.id);
        if (job.backupHash && job.backupHash !== backup.hash)
          throw Error("The retained job backup changed. Preparation stopped.");
        await prisma.demoJob.update({
          where: { id: job.id },
          data: { backupPath: backup.path, backupHash: backup.hash },
        });
        if (job.kind === "CLEANUP") await resetDemo(job.id, job.previewHash!);
        else {
          const result = await seedBusinessDemo(true, {
            jobId: job.id,
            before: barrier,
            complete: async (tx, result) => {
              await tx.demoJob.update({
                where: { id: job.id },
                data: { status: "DONE", finishedAt: new Date(), result },
              });
              await tx.demoControl.updateMany({
                where: { id: 1, maintenanceJob: job.id },
                data: { maintenanceJob: null },
              });
            },
          });
          await prisma.$transaction(async (tx) => {
            await tx.demoJob.updateMany({
              where: { id: job.id, status: "RUNNING" },
              data: {
                status: "DONE",
                finishedAt: new Date(),
                result: result as any,
              },
            });
            await tx.demoControl.updateMany({
              where: { id: 1, maintenanceJob: job.id },
              data: { maintenanceJob: null },
            });
          });
        }
        console.log(`Demo ${job.kind.toLowerCase()} completed: ${job.id}`);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "Preparation failed.";
        // Do not expose raw SQL, connection strings or backup paths through the web API.
        const safe =
          /^(Data changed|Mixed demo|Unexpected database|Another maintenance|The retained job backup|Database backup|Demo manager requires|The current accounting date|The data changed|Preserved records|Ledger reconciliation)/.test(
            reason,
          )
            ? reason
            : "The demo job stopped. Refresh status and check the private worker log before retrying. Seed and reset transactions are atomic.";
        console.error(
          `Demo job ${job.id} failed:`,
          reason.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[redacted]"),
        );
        await prisma.$transaction(async (tx) => {
          await tx.demoJob.updateMany({
            where: { id: job.id, status: { in: ["QUEUED", "RUNNING"] } },
            data: { status: "FAILED", error: safe, finishedAt: new Date() },
          });
          await tx.demoControl.updateMany({
            where: { id: 1, maintenanceJob: job.id },
            data: { maintenanceJob: null },
          });
        });
      }
    },
    { timeout: 2400000, maxWait: 10000 },
  );
}

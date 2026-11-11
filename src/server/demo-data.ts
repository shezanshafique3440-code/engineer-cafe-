import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { DB } from "./business/core";
import { businessLock } from "./business/core";
import { HttpError, requireUser } from "./api";

export const DEMO_BATCH = "business-demo-v2";
export const RESET_PHRASE = "RESET DEMO DATA";
export const q = (s: string) => '"' + s.replaceAll('"', '""') + '"';
// Runtime database snapshots contain heterogeneous PostgreSQL column values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Validated/fingerprinted before cleanup; not an application DTO.
type Data = Record<string, any>;
export type SnapshotRow = { data: Data; fingerprint: string };
type FK = { child: string; parent: string; column: string; target: string };
export type Snapshot = { tables: Map<string, SnapshotRow[]>; fks: FK[] };
export const rowId = (table: string, row: Data): string =>
  table === "BusinessRequest"
    ? row.key
    : table === "AddonGroupOnProduct"
      ? JSON.stringify([row.productId, row.addonGroupId])
      : String(row.id);
const key = (table: string, id: string) => table + ":" + id;
const prefix = (value: unknown) =>
  typeof value === "string" &&
  /^(cafe-demo-v[12]-|cafe-practice-v1-)/.test(value);
const ownership: Record<string, string[]> = {
  Address: ["userId"],
  PasswordReset: ["userId"],
  StaffAccess: ["userId"],
  OrderItem: ["orderId"],
  OrderItemAddon: ["orderItemId"],
  OrderEvent: ["orderId"],
  Recipe: ["productId", "addonId"],
  RecipeLine: ["recipeId"],
  IngredientReservation: ["orderId"],
  StockMovement: ["ingredientId"],
  BusinessPurchase: ["supplierId"],
  PurchaseLine: ["purchaseId"],
  BusinessPayment: ["journalId", "orderId", "purchaseId", "payrollId"],
  BusinessPosting: ["journalId"],
  BusinessSaleLine: ["orderId"],
  Attendance: ["employeeId"],
  PayrollRecord: ["employeeId"],
  CashShift: ["drawerId"],
  TableSession: ["tableId"],
  DeliveryCommission: ["orderId"],
  DeliveryTransfer: ["riderId"],
  Review: ["userId"],
  Favorite: ["userId"],
  LoyaltyEntry: ["userId"],
  PushSubscription: ["userId"],
  CafePurchaseOrder: ["supplierId"],
  CafeApproval: ["orderId"],
  AddonGroupOnProduct: ["productId"],
  ComboItem: ["productId"],
};
export async function requireOwner() {
  const actor = await requireUser();
  if (actor.role !== "ADMIN")
    throw new HttpError(
      403,
      "Only a cafe owner can manage demonstration data.",
    );
  return actor;
}
export async function snapshot(tx: DB): Promise<Snapshot> {
  const names = await tx.$queryRaw<
    { name: string }[]
  >`SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'Demo%' AND tablename <> '_prisma_migrations' ORDER BY tablename`;
  const tables = new Map<string, SnapshotRow[]>();
  for (const { name } of names)
    tables.set(
      name,
      await tx.$queryRawUnsafe<SnapshotRow[]>(
        `SELECT to_jsonb(t) AS data, md5(to_jsonb(t)::text) AS fingerprint FROM ${q(name)} t ORDER BY to_jsonb(t)::text`,
      ),
    );
  const fks = await tx.$queryRaw<
    FK[]
  >`SELECT c.relname AS child, p.relname AS parent, a.attname AS column, b.attname AS target FROM pg_constraint fk JOIN pg_class c ON c.oid=fk.conrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace JOIN pg_class p ON p.oid=fk.confrelid JOIN LATERAL unnest(fk.conkey,fk.confkey) AS k(cnum,pnum) ON true JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.cnum JOIN pg_attribute b ON b.attrelid=p.oid AND b.attnum=k.pnum WHERE fk.contype='f' AND ns.nspname='public'`;
  return { tables, fks };
}
export async function planCleanup(tx: DB) {
  const state = await snapshot(tx);
  const records = await tx.demoRecord.findMany();
  const owned = new Set(records.map((r) => key(r.tableName, r.recordId)));
  const rows = (t: string) => state.tables.get(t) ?? [];
  const legacy = rows("BusinessRequest").some(
    (r) => r.data.key === "business-demo-v1",
  );
  const practice = rows("BusinessRequest").some(
    (r) => r.data.key === "business-practice-v1",
  );
  for (const [table, entries] of state.tables)
    for (const r of entries) {
      if (
        (legacy && /^cafe-demo-v1-/.test(String(r.data.id))) ||
        (practice && /^cafe-practice-v1-/.test(String(r.data.id)))
      )
        owned.add(key(table, rowId(table, r.data)));
    }
  const index = new Map<string, SnapshotRow>();
  for (const [table, entries] of state.tables)
    for (const r of entries) index.set(key(table, rowId(table, r.data)), r);
  let changed = true;
  while (changed) {
    changed = false;
    const ids = new Set([...owned].map((k) => k.slice(k.indexOf(":") + 1)));
    for (const [table, entries] of state.tables)
      for (const r of entries) {
        const k = key(table, rowId(table, r.data));
        if (owned.has(k)) continue;
        let include = false;
        for (const field of ownership[table] ?? []) {
          const fk = state.fks.find(
            (f) => f.child === table && f.column === field,
          );
          if (
            fk &&
            r.data[field] &&
            owned.has(key(fk.parent, String(r.data[field])))
          )
            include = true;
        }
        if (table === "BusinessJournal")
          include ||=
            ids.has(r.data.sourceId) ||
            owned.has(key("Order", r.data.orderId)) ||
            owned.has(key("BusinessJournal", r.data.reversalOfId)) ||
            ((legacy || practice) && prefix(r.data.actorId));
        if (table === "BusinessAudit")
          include ||=
            ids.has(r.data.entityId) ||
            ((legacy || practice) && prefix(r.data.actorId));
        if (
          table === "BusinessRequest" &&
          !["business-demo-v1", "business-practice-v1"].includes(r.data.key)
        )
          include ||=
            r.data.key === DEMO_BATCH ||
            /cafe-demo-v[12]-|cafe-practice-v1-/.test(r.data.key) ||
            ids.has(r.data.result?.id);
        if (include) {
          owned.add(k);
          changed = true;
        }
      }
  }
  const blockers = new Set<string>();
  const captured = new Set(records.map((r) => key(r.tableName, r.recordId)));
  const importerEntities = new Set<string>();
  for (const r of rows("BusinessJournal"))
    if (prefix(r.data.actorId)) importerEntities.add(r.data.sourceId);
  for (const r of rows("BusinessAudit"))
    if (prefix(r.data.actorId)) importerEntities.add(r.data.entityId);
  // A demo ingredient is not proof that every physical count entered against it
  // was synthetic. Old unregistered financial documents need importer provenance
  // or a proven demo order; otherwise preserve them and block the reset.
  for (const table of ["StockMovement", "BusinessPurchase", "PayrollRecord"])
    for (const r of rows(table)) {
      const k = key(table, rowId(table, r.data));
      if (
        !owned.has(k) ||
        captured.has(k) ||
        prefix(r.data.id) ||
        importerEntities.has(r.data.id)
      )
        continue;
      if (
        table === "StockMovement" &&
        r.data.orderId &&
        owned.has(key("Order", r.data.orderId))
      )
        continue;
      if (table === "StockMovement" && r.data.purchaseLineId) {
        const line = rows("PurchaseLine").find(
          (l) => l.data.id === r.data.purchaseLineId,
        );
        if (line && importerEntities.has(line.data.purchaseId)) continue;
      }
      blockers.add(
        `${table} ${r.data.id} has no recorded demo provenance. Preserve and review this financial entry before cleanup.`,
      );
    }

  for (const k of owned) if (!index.has(k)) owned.delete(k); // removed mutable demo records need no action
  const conversions: {
    lineId: string;
    recipeId: string;
    ingredientId: string;
    name: string;
    unit: string;
  }[] = [];
  const ingredients = new Map(
    rows("Ingredient").map((r) => [r.data.id, r.data]),
  );
  const recipes = new Map(rows("Recipe").map((r) => [r.data.id, r.data]));
  for (const r of rows("RecipeLine"))
    if (
      !owned.has(key("RecipeLine", r.data.id)) &&
      owned.has(key("Ingredient", r.data.ingredientId))
    ) {
      const recipe = recipes.get(r.data.recipeId),
        ing = ingredients.get(r.data.ingredientId)!;
      // Only the known old practice importer was allowed to bind real menu recipes.
      if (
        !practice ||
        !String(ing.id).startsWith("cafe-demo-v1-") ||
        !String(recipe?.note).includes("ASSUMED / TEST")
      ) {
        blockers.add(
          `Recipe ${r.data.recipeId} uses demo stock without the known practice provenance.`,
        );
        continue;
      }
      const name = String(ing.name).replace(/^DEMO · /, "");
      const match = rows("Ingredient").find(
        (x) => !owned.has(key("Ingredient", x.data.id)) && x.data.name === name,
      );
      if (match && match.data.unit !== ing.unit)
        blockers.add(
          `Ingredient ${name} has a different live unit; reconcile it first.`,
        );
      conversions.push({
        lineId: r.data.id,
        recipeId: r.data.recipeId,
        ingredientId: r.data.ingredientId,
        name,
        unit: ing.unit,
      });
    }
  const converted = new Set(conversions.map((c) => c.lineId));
  // Validate every edge in both directions, including CASCADE and SET NULL links.
  // A genuine child is never silently adopted merely because it references demo stock.
  for (const fk of state.fks) {
    const parents = new Map(
      rows(fk.parent).map((r) => [String(r.data[fk.target]), r]),
    );
    for (const r of rows(fk.child)) {
      if (r.data[fk.column] == null) continue;
      const parent = parents.get(String(r.data[fk.column]));
      if (!parent) continue;
      const a = owned.has(key(fk.child, rowId(fk.child, r.data))),
        b = owned.has(key(fk.parent, rowId(fk.parent, parent.data)));
      if (a === b) continue;
      if (
        !a &&
        fk.child === "RecipeLine" &&
        fk.column === "ingredientId" &&
        converted.has(r.data.id)
      )
        continue;
      if (
        a &&
        fk.parent === "BusinessAccount" &&
        (!parent.data.isMoney || parent.data.code === "RIDER_CASH")
      )
        continue;
      blockers.add(
        `${fk.child} ${rowId(fk.child, r.data)} crosses into ${b ? "demo" : "preserved"} ${fk.parent} through ${fk.column}.`,
      );
    }
  }
  for (const r of rows("User"))
    if (owned.has(key("User", r.data.id)) && r.data.role === "ADMIN")
      blockers.add(
        "An owner account was marked as demo. Owner accounts are always preserved.",
      );
  // Soft references have no FK. Fail closed for ambiguous genuine draft/financial documents.
  const demoIds = new Set([...owned].map((k) => k.slice(k.indexOf(":") + 1)));
  const references = (value: unknown): boolean =>
    typeof value === "string"
      ? demoIds.has(value)
      : Array.isArray(value)
        ? value.some(references)
        : value != null && typeof value === "object"
          ? Object.values(value).some(references)
          : false;
  for (const table of [
    "CafePurchaseOrder",
    "CafeStockCount",
    "CafeApproval",
    "BusinessRequest",
    "StockMovement",
    "BusinessJournal",
    "BusinessAudit",
    "LoyaltyEntry",
    "ComboItem",
    "PayrollRecord",
  ])
    for (const r of rows(table)) {
      if (
        owned.has(key(table, rowId(table, r.data))) ||
        (table === "BusinessRequest" &&
          ["business-demo-v1", "business-practice-v1"].includes(r.data.key))
      )
        continue;
      if (references(r.data))
        blockers.add(
          `Preserved ${table} ${rowId(table, r.data)} contains a demo reference. Review it first.`,
        );
    }
  const config = rows("BusinessConfig")[0]?.data;
  if (config?.lockedThrough)
    for (const r of rows("BusinessJournal"))
      if (
        owned.has(key("BusinessJournal", r.data.id)) &&
        String(r.data.date).slice(0, 10) <=
          String(config.lockedThrough).slice(0, 10)
      ) {
        blockers.add(
          "Demo journals fall in a closed accounting period. Closed periods are never unlocked by cleanup.",
        );
        break;
      }
  const counts: Record<string, { remove: number; preserve: number }> = {};
  const fingerprint = createHash("sha256");
  for (const [table, entries] of state.tables) {
    counts[table] = { remove: 0, preserve: 0 };
    for (const r of entries) {
      const k = key(table, rowId(table, r.data));
      counts[table][owned.has(k) ? "remove" : "preserve"]++;
      // Includes preserved rows: any business change invalidates the reviewed preview.
      fingerprint.update(k + ":" + r.fingerprint + "\n");
    }
  }
  fingerprint.update(JSON.stringify([...owned].sort()));
  const preview = {
    hash: fingerprint.digest("hex"),
    counts,
    recipesToReview: new Set(conversions.map((c) => c.recipeId)).size,
    cleanIngredientMasters: new Set(conversions.map((c) => c.ingredientId))
      .size,
    blockers: [...blockers].sort(),
    total: [...owned].length,
    note: "Only proven demo records are removed. Existing menu and owner accounts stay. Assumed practice recipes move to zero-stock ingredients and require review. Records you create manually are preserved unless their demo provenance can be proven; mixed records stop reset.",
  };
  return { preview, state, owned, conversions };
}
export async function cleanupPreview() {
  return prisma.$transaction(async (tx) => (await planCleanup(tx)).preview, {
    isolationLevel: "RepeatableRead",
    timeout: 90000,
  });
}
export async function demoStatus() {
  const [control, jobs, records] = await Promise.all([
    prisma.demoControl.findUnique({ where: { id: 1 } }),
    prisma.demoJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        kind: true,
        status: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        result: true,
        error: true,
      },
    }),
    prisma.demoRecord.count({ where: { batchId: DEMO_BATCH } }),
  ]);
  return {
    maintenance: Boolean(control?.maintenanceJob),
    jobs,
    hasBulkData: records > 0,
  };
}
export async function queueDemo(
  kind: "SEED" | "CLEANUP",
  actor: { id: string; name: string },
  previewHash?: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await businessLock(tx);
      if (
        await tx.demoJob.count({
          where: { status: { in: ["QUEUED", "RUNNING"] } },
        })
      )
        throw new HttpError(409, "A demo job is already queued or running.");
      if (
        kind === "SEED" &&
        (await tx.demoRecord.count({ where: { batchId: DEMO_BATCH } }))
      )
        throw new HttpError(
          409,
          "The bulk dataset is already loaded. Preview and reset it before loading again.",
        );
      if (kind === "CLEANUP") {
        const plan = await planCleanup(tx);
        if (plan.preview.hash !== previewHash)
          throw new HttpError(
            409,
            "The data changed. Refresh the cleanup preview first.",
          );
        if (plan.preview.blockers.length)
          throw new HttpError(
            409,
            "Resolve the mixed-data blockers before resetting demo data.",
          );
        if (!plan.preview.total)
          throw new HttpError(
            409,
            "There are no proven demo records to remove.",
          );
      }
      return tx.demoJob.create({
        data: { kind, actorId: actor.id, actorName: actor.name, previewHash },
      });
    },
    { timeout: 90000 },
  );
}

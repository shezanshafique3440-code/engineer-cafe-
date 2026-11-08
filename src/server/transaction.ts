import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// One cafe: serialize ledger mutations before any reads. Database transactions
// still provide rollback; every order/purchase/refund uses this same lock.
export function businessTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(834211)`;
      return fn(tx);
    },
    { maxWait: 15000, timeout: 20000 },
  );
}

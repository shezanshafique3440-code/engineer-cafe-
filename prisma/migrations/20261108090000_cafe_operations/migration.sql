BEGIN;
ALTER TABLE "CashShift"
  ADD COLUMN "closedById" TEXT,
  ADD COLUMN "closedByName" TEXT,
  ADD COLUMN "denominations" JSONB,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedByName" TEXT,
  ADD COLUMN "reviewNote" TEXT;
CREATE TABLE "CafePurchaseOrder" (
  "id" TEXT NOT NULL PRIMARY KEY, "reference" TEXT NOT NULL UNIQUE,
  "supplierId" TEXT NOT NULL REFERENCES "BusinessParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "supplierName" TEXT NOT NULL, "expectedOn" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','APPROVED','RECEIVED','CANCELLED')),
  "lines" JSONB NOT NULL, "total" DECIMAL(18,2) NOT NULL CHECK ("total">0), "note" TEXT NOT NULL,
  "createdById" TEXT NOT NULL, "createdByName" TEXT NOT NULL,
  "approvedById" TEXT, "approvedByName" TEXT, "approvedAt" TIMESTAMP(3),
  "purchaseId" TEXT UNIQUE REFERENCES "BusinessPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "CafePurchaseOrder_status_createdAt_idx" ON "CafePurchaseOrder"("status","createdAt");
CREATE TABLE "CafeStockCount" (
  "id" TEXT NOT NULL PRIMARY KEY, "reference" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','POSTED','CANCELLED')),
  "date" DATE NOT NULL, "lines" JSONB NOT NULL, "note" TEXT NOT NULL,
  "createdById" TEXT NOT NULL, "createdByName" TEXT NOT NULL, "postedByName" TEXT, "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "CafeStockCount_status_createdAt_idx" ON "CafeStockCount"("status","createdAt");
CREATE TABLE "CafeApproval" (
  "id" TEXT NOT NULL PRIMARY KEY, "kind" TEXT NOT NULL CHECK ("kind" IN ('REFUND','DISCOUNT')),
  "orderId" TEXT REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "orderNumber" TEXT, "scopeHash" TEXT, "context" JSONB,
  "amount" DECIMAL(18,2) NOT NULL CHECK ("amount">0), "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','REJECTED','USED')),
  "requestedById" TEXT NOT NULL, "requestedByName" TEXT NOT NULL,
  "reviewedById" TEXT, "reviewedByName" TEXT, "reviewNote" TEXT, "reviewedAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3), "resultId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "CafeApproval_status_createdAt_idx" ON "CafeApproval"("status","createdAt");
CREATE INDEX "CafeApproval_requestedById_status_idx" ON "CafeApproval"("requestedById","status");

COMMIT;

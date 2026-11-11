ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "cashierId" TEXT, ADD COLUMN "cashierName" TEXT, ADD COLUMN "capturedAt" TIMESTAMP(3);
CREATE INDEX "Order_riderId_createdAt_idx" ON "Order"("riderId","createdAt");
CREATE INDEX "Order_placedAt_idx" ON "Order"("placedAt");
CREATE INDEX "Order_cashShiftId_idx" ON "Order"("cashShiftId");
CREATE INDEX "Order_cashierId_createdAt_idx" ON "Order"("cashierId","createdAt");
CREATE INDEX "BusinessPosting_journalId_idx" ON "BusinessPosting"("journalId");
CREATE INDEX "PurchaseLine_purchaseId_idx" ON "PurchaseLine"("purchaseId");
CREATE TABLE "PasswordReset" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "tokenHash" TEXT NOT NULL UNIQUE, "expiresAt" TIMESTAMP(3) NOT NULL,
 "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PasswordReset_userId_createdAt_idx" ON "PasswordReset"("userId","createdAt");

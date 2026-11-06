BEGIN;
-- Additive only: previous releases can continue reading their existing columns.
ALTER TABLE "Order" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'WEB',
ADD COLUMN "requestKey" TEXT, ADD COLUMN "requestHash" TEXT,
ADD COLUMN "scheduledAt" TIMESTAMP(3), ADD COLUMN "cashReceived" INTEGER,
ADD COLUMN "cashChange" INTEGER, ADD COLUMN "loyaltyPointsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "loyaltyDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Order_requestKey_key" ON "Order"("requestKey");
CREATE INDEX "Order_scheduledAt_status_idx" ON "Order"("scheduledAt", "status");
ALTER TABLE "CafeSetting" ADD COLUMN "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "loyaltyEarnEvery" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "loyaltyRewardPoints" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "loyaltyRewardValue" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "schedulingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "scheduleLeadMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "scheduleDaysAhead" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN "scheduleOpenMinute" INTEGER NOT NULL DEFAULT 480,
ADD COLUMN "scheduleCloseMinute" INTEGER NOT NULL DEFAULT 120;
CREATE TABLE "LoyaltyEntry" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "orderKey" TEXT NOT NULL, "kind" TEXT NOT NULL, "points" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "LoyaltyEntry_orderKey_kind_key" ON "LoyaltyEntry"("orderKey", "kind");
CREATE INDEX "LoyaltyEntry_userId_createdAt_idx" ON "LoyaltyEntry"("userId", "createdAt");
CREATE TABLE "PushSubscription" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "endpoint" TEXT NOT NULL UNIQUE, "p256dh" TEXT NOT NULL, "auth" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "NotificationJob" (
 "id" TEXT PRIMARY KEY, "eventKey" TEXT NOT NULL UNIQUE, "title" TEXT NOT NULL,
 "body" TEXT NOT NULL, "url" TEXT NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0,
 "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deliveredAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "NotificationJob_deliveredAt_availableAt_idx" ON "NotificationJob"("deliveredAt", "availableAt");
CREATE TABLE "OrderCounter" ("id" INTEGER PRIMARY KEY DEFAULT 1, "value" INTEGER NOT NULL DEFAULT 999);
INSERT INTO "OrderCounter" ("id", "value") SELECT 1, GREATEST(999, COALESCE(MAX(CASE WHEN "orderNumber" ~ '^EC[0-9]{1,9}$' THEN SUBSTRING("orderNumber" FROM 3)::INTEGER END),999)) FROM "Order";

COMMIT;

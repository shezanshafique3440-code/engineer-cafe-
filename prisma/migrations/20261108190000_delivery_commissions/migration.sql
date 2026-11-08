-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "riderAssignedAt" TIMESTAMP(3),
ADD COLUMN     "riderId" TEXT;

-- CreateTable
CREATE TABLE "DeliveryRider" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryCommission" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "rate" INTEGER NOT NULL DEFAULT 15,
    "basis" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "journalId" TEXT,
    "reversalJournalId" TEXT,
    "date" DATE NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTransfer" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "accountId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRider_code_key" ON "DeliveryRider"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRider_partyId_key" ON "DeliveryRider"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryCommission_orderId_key" ON "DeliveryCommission"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryCommission_journalId_key" ON "DeliveryCommission"("journalId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryCommission_reversalJournalId_key" ON "DeliveryCommission"("reversalJournalId");

-- CreateIndex
CREATE INDEX "DeliveryCommission_riderId_date_idx" ON "DeliveryCommission"("riderId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTransfer_journalId_key" ON "DeliveryTransfer"("journalId");

-- CreateIndex
CREATE INDEX "DeliveryTransfer_riderId_date_idx" ON "DeliveryTransfer"("riderId", "date");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "DeliveryRider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRider" ADD CONSTRAINT "DeliveryRider_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "BusinessParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCommission" ADD CONSTRAINT "DeliveryCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCommission" ADD CONSTRAINT "DeliveryCommission_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "DeliveryRider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCommission" ADD CONSTRAINT "DeliveryCommission_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "BusinessJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCommission" ADD CONSTRAINT "DeliveryCommission_reversalJournalId_fkey" FOREIGN KEY ("reversalJournalId") REFERENCES "BusinessJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTransfer" ADD CONSTRAINT "DeliveryTransfer_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "DeliveryRider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTransfer" ADD CONSTRAINT "DeliveryTransfer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTransfer" ADD CONSTRAINT "DeliveryTransfer_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "BusinessJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payouts and cash remittances are immutable, like the existing journal ledger.
ALTER TABLE "DeliveryCommission" ADD CONSTRAINT "delivery_commission_amount_check" CHECK (amount >= 0 AND basis >= 0 AND rate = 15);
ALTER TABLE "DeliveryTransfer" ADD CONSTRAINT "delivery_transfer_amount_check" CHECK (amount > 0 AND kind IN ('COMMISSION', 'REMITTANCE', 'RECOVERY'));
CREATE TRIGGER immutable_delivery_transfer BEFORE UPDATE OR DELETE ON "DeliveryTransfer" FOR EACH ROW EXECUTE FUNCTION cafe_immutable_record();
CREATE FUNCTION cafe_delivery_commission_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Commission history cannot be deleted'; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW."orderId" IS DISTINCT FROM OLD."orderId" OR NEW."riderId" IS DISTINCT FROM OLD."riderId"
    OR NEW.rate IS DISTINCT FROM OLD.rate OR NEW.basis IS DISTINCT FROM OLD.basis OR NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW."journalId" IS DISTINCT FROM OLD."journalId" OR NEW.date IS DISTINCT FROM OLD.date OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    OR OLD."reversedAt" IS NOT NULL OR NEW."reversedAt" IS NULL THEN
    RAISE EXCEPTION 'Commission amounts are immutable; record a reversal';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_delivery_commission BEFORE UPDATE OR DELETE ON "DeliveryCommission" FOR EACH ROW EXECUTE FUNCTION cafe_delivery_commission_guard();

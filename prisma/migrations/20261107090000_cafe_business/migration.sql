BEGIN;
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "recipeRequired" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "amountRefunded" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "businessConsumedAt" TIMESTAMP(3),
ADD COLUMN     "businessCredit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "businessInvoicedAt" TIMESTAMP(3),
ADD COLUMN     "businessPartyId" TEXT,
ADD COLUMN     "businessTracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "businessVoidedAt" TIMESTAMP(3),
ADD COLUMN     "cashShiftId" TEXT,
ADD COLUMN     "serviceMode" TEXT NOT NULL DEFAULT 'TAKEAWAY',
ADD COLUMN     "tableSessionId" TEXT;

-- CreateTable
CREATE TABLE "BusinessConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "lockedThrough" DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "employeeId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessParty" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "userId" TEXT,
    "creditLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "payBasis" TEXT NOT NULL DEFAULT 'MONTHLY',
    "basePay" DECIMAL(18,2) NOT NULL,
    "overtimeRate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "joinedOn" DATE NOT NULL,
    "leftOn" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "overtimeHours" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "basePay" DECIMAL(18,2) NOT NULL,
    "unpaidDeduction" DECIMAL(18,2) NOT NULL,
    "overtimePay" DECIMAL(18,2) NOT NULL,
    "bonus" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "manualDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advanceApplied" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "earnedPay" DECIMAL(18,2) NOT NULL,
    "netPay" DECIMAL(18,2) NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "stockValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reorderAt" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "addonId" TEXT,
    "yieldUnits" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeLine" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "RecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "balanceQuantity" DECIMAL(18,4) NOT NULL,
    "balanceValue" DECIMAL(18,2) NOT NULL,
    "orderId" TEXT,
    "orderItemKey" TEXT,
    "purchaseLineId" TEXT,
    "note" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "isMoney" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BusinessAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessJournal" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "orderId" TEXT,
    "shiftId" TEXT,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPosting" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "partyId" TEXT,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "BusinessPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPurchase" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "total" DECIMAL(18,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "returnedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "returnedCost" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPayment" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "partyId" TEXT,
    "orderId" TEXT,
    "purchaseId" TEXT,
    "payrollId" TEXT,
    "accountId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashDrawer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CashDrawer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashShift" (
    "id" TEXT NOT NULL,
    "drawerId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "openedByName" TEXT NOT NULL,
    "openingCash" DECIMAL(18,2) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "expectedCash" DECIMAL(18,2),
    "actualCash" DECIMAL(18,2),
    "variance" DECIMAL(18,2),
    "closeNote" TEXT,

    CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeTable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CafeTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSession" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "waiterId" TEXT,
    "openedById" TEXT NOT NULL,
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSaleLine" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemKey" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "gross" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL,
    "net" DECIMAL(18,2) NOT NULL,
    "cost" DECIMAL(18,2) NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessRequest" (
    "key" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessRequest_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffAccess_userId_key" ON "StaffAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAccess_employeeId_key" ON "StaffAccess"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessParty_userId_key" ON "BusinessParty"("userId");

-- CreateIndex
CREATE INDEX "BusinessParty_kind_isActive_idx" ON "BusinessParty"("kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_code_key" ON "Employee"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_partyId_key" ON "Employee"("partyId");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_date_key" ON "Attendance"("employeeId", "date");

-- CreateIndex
CREATE INDEX "PayrollRecord_period_status_idx" ON "PayrollRecord"("period", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_productId_key" ON "Recipe"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_addonId_key" ON "Recipe"("addonId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeLine_recipeId_ingredientId_key" ON "RecipeLine"("recipeId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_eventKey_key" ON "StockMovement"("eventKey");

-- CreateIndex
CREATE INDEX "StockMovement_ingredientId_createdAt_idx" ON "StockMovement"("ingredientId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAccount_code_key" ON "BusinessAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessJournal_eventKey_key" ON "BusinessJournal"("eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessJournal_reversalOfId_key" ON "BusinessJournal"("reversalOfId");

-- CreateIndex
CREATE INDEX "BusinessJournal_date_source_idx" ON "BusinessJournal"("date", "source");

-- CreateIndex
CREATE INDEX "BusinessJournal_orderId_idx" ON "BusinessJournal"("orderId");

-- CreateIndex
CREATE INDEX "BusinessPosting_accountId_journalId_idx" ON "BusinessPosting"("accountId", "journalId");

-- CreateIndex
CREATE INDEX "BusinessPosting_partyId_idx" ON "BusinessPosting"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPurchase_supplierId_invoiceNumber_key" ON "BusinessPurchase"("supplierId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "BusinessPayment_partyId_date_idx" ON "BusinessPayment"("partyId", "date");

-- CreateIndex
CREATE INDEX "BusinessPayment_orderId_idx" ON "BusinessPayment"("orderId");

-- CreateIndex
CREATE INDEX "BusinessPayment_payrollId_idx" ON "BusinessPayment"("payrollId");

-- CreateIndex
CREATE UNIQUE INDEX "CashDrawer_name_key" ON "CashDrawer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CashDrawer_accountId_key" ON "CashDrawer"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "CafeTable_name_key" ON "CafeTable"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSaleLine_eventKey_key" ON "BusinessSaleLine"("eventKey");

-- CreateIndex
CREATE INDEX "BusinessSaleLine_date_idx" ON "BusinessSaleLine"("date");

-- CreateIndex
CREATE INDEX "BusinessAudit_entity_entityId_idx" ON "BusinessAudit"("entity", "entityId");

-- CreateIndex
CREATE INDEX "BusinessAudit_createdAt_idx" ON "BusinessAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_businessPartyId_fkey" FOREIGN KEY ("businessPartyId") REFERENCES "BusinessParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cashShiftId_fkey" FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAccess" ADD CONSTRAINT "StaffAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAccess" ADD CONSTRAINT "StaffAccess_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessParty" ADD CONSTRAINT "BusinessParty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "BusinessParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "ProductAddon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessJournal" ADD CONSTRAINT "BusinessJournal_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessJournal" ADD CONSTRAINT "BusinessJournal_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "CashShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessJournal" ADD CONSTRAINT "BusinessJournal_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "BusinessJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPosting" ADD CONSTRAINT "BusinessPosting_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "BusinessJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPosting" ADD CONSTRAINT "BusinessPosting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPosting" ADD CONSTRAINT "BusinessPosting_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "BusinessParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPurchase" ADD CONSTRAINT "BusinessPurchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "BusinessParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "BusinessPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPayment" ADD CONSTRAINT "BusinessPayment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "BusinessParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPayment" ADD CONSTRAINT "BusinessPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPayment" ADD CONSTRAINT "BusinessPayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "BusinessPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPayment" ADD CONSTRAINT "BusinessPayment_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "PayrollRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPayment" ADD CONSTRAINT "BusinessPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPayment" ADD CONSTRAINT "BusinessPayment_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "BusinessJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawer" ADD CONSTRAINT "CashDrawer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_drawerId_fkey" FOREIGN KEY ("drawerId") REFERENCES "CashDrawer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CafeTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSaleLine" ADD CONSTRAINT "BusinessSaleLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ingredient" ADD CONSTRAINT ingredient_nonnegative CHECK (quantity >= 0 AND "stockValue" >= 0 AND (quantity > 0 OR "stockValue" = 0));
ALTER TABLE "Recipe" ADD CONSTRAINT recipe_subject CHECK (("productId" IS NOT NULL)::integer + ("addonId" IS NOT NULL)::integer = 1), ADD CONSTRAINT recipe_positive_yield CHECK ("yieldUnits" > 0);
ALTER TABLE "RecipeLine" ADD CONSTRAINT recipe_line_positive CHECK (quantity > 0);
ALTER TABLE "BusinessPosting" ADD CONSTRAINT posting_one_side CHECK (debit >= 0 AND credit >= 0 AND ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)));
ALTER TABLE "PurchaseLine" ADD CONSTRAINT purchase_quantity_valid CHECK (quantity > 0 AND "totalCost" >= 0 AND "returnedQuantity" >= 0 AND "returnedQuantity" <= quantity AND "returnedCost" >= 0 AND "returnedCost" <= "totalCost");
CREATE UNIQUE INDEX one_open_drawer ON "CashShift" ("drawerId") WHERE "closedAt" IS NULL;
CREATE UNIQUE INDEX one_open_cashier_shift ON "CashShift" ("openedById") WHERE "closedAt" IS NULL;
CREATE UNIQUE INDEX one_open_table ON "TableSession" ("tableId") WHERE "closedAt" IS NULL;
CREATE OR REPLACE FUNCTION cafe_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Posted cafe records cannot be edited or deleted; record a reversal'; END; $$;
CREATE TRIGGER immutable_journal BEFORE UPDATE OR DELETE ON "BusinessJournal" FOR EACH ROW EXECUTE FUNCTION cafe_immutable_record();
CREATE TRIGGER immutable_posting BEFORE UPDATE OR DELETE ON "BusinessPosting" FOR EACH ROW EXECUTE FUNCTION cafe_immutable_record();
CREATE TRIGGER immutable_stock_move BEFORE UPDATE OR DELETE ON "StockMovement" FOR EACH ROW EXECUTE FUNCTION cafe_immutable_record();
CREATE TRIGGER immutable_sale_line BEFORE UPDATE OR DELETE ON "BusinessSaleLine" FOR EACH ROW EXECUTE FUNCTION cafe_immutable_record();
CREATE TRIGGER immutable_business_payment BEFORE UPDATE OR DELETE ON "BusinessPayment" FOR EACH ROW EXECUTE FUNCTION cafe_immutable_record();
CREATE TRIGGER immutable_business_audit BEFORE UPDATE OR DELETE ON "BusinessAudit" FOR EACH ROW EXECUTE FUNCTION cafe_immutable_record();
CREATE OR REPLACE FUNCTION cafe_balanced_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id text; difference numeric; lines integer;
BEGIN
 IF TG_TABLE_NAME = 'BusinessJournal' THEN target_id := NEW.id; ELSE target_id := NEW."journalId"; END IF;
 SELECT count(*), coalesce(sum(debit-credit),0) INTO lines,difference FROM "BusinessPosting" WHERE "journalId"=target_id;
 IF lines < 2 OR difference <> 0 THEN RAISE EXCEPTION 'Unbalanced or empty journal: %',target_id; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER journal_balance_header AFTER INSERT ON "BusinessJournal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cafe_balanced_journal();
CREATE CONSTRAINT TRIGGER journal_balance_lines AFTER INSERT ON "BusinessPosting" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cafe_balanced_journal();
CREATE OR REPLACE FUNCTION cafe_payroll_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(73190422);
 IF NEW.status='POSTED' AND EXISTS (SELECT 1 FROM "PayrollRecord" p WHERE p.id<>NEW.id AND p."employeeId"=NEW."employeeId" AND p.status='POSTED' AND p."startsOn"<=NEW."endsOn" AND p."endsOn">=NEW."startsOn") THEN RAISE EXCEPTION 'Overlapping posted payroll'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER payroll_no_overlap BEFORE INSERT OR UPDATE ON "PayrollRecord" FOR EACH ROW EXECUTE FUNCTION cafe_payroll_overlap();
ALTER TABLE "Order" ADD COLUMN "cashTendered" DECIMAL(18,2), ADD COLUMN "changeGiven" DECIMAL(18,2), ADD COLUMN "tableName" TEXT, ADD COLUMN "waiterName" TEXT;
CREATE OR REPLACE FUNCTION cafe_business_order_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('cafe.business_session',true) IS DISTINCT FROM '1' THEN
  IF TG_OP='INSERT' THEN
   IF COALESCE((SELECT enabled FROM "BusinessConfig" WHERE id=1),false) THEN RAISE EXCEPTION 'Business integration is active; use the current cafe release'; END IF;
  ELSIF OLD."businessTracked" THEN RAISE EXCEPTION 'Tracked cafe orders require the business-aware release'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;
CREATE TRIGGER business_order_guard BEFORE INSERT OR UPDATE OR DELETE ON "Order" FOR EACH ROW EXECUTE FUNCTION cafe_business_order_guard();
CREATE TABLE "IngredientReservation" (
 "id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "orderItemKey" TEXT NOT NULL, "ingredientId" TEXT NOT NULL REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "quantity" DECIMAL(18,4) NOT NULL CHECK (quantity>0), "consumedAt" TIMESTAMP(3), "releasedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("consumedAt" IS NULL OR "releasedAt" IS NULL)
);
CREATE UNIQUE INDEX "IngredientReservation_orderId_orderItemKey_ingredientId_key" ON "IngredientReservation" ("orderId","orderItemKey","ingredientId");
CREATE INDEX "IngredientReservation_ingredientId_consumedAt_releasedAt_idx" ON "IngredientReservation" ("ingredientId","consumedAt","releasedAt");
COMMIT;

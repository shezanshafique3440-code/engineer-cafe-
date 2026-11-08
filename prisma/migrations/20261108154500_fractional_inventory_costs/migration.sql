-- AlterTable
ALTER TABLE "InventoryItem" ALTER COLUMN "averageCost" SET DEFAULT 0,
ALTER COLUMN "averageCost" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "PurchaseLine" ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(14,4);


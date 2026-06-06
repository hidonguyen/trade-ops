-- Add exchangeRate with a permanent default of 1 (correct for VND deposits; existing rows backfill to 1).
ALTER TABLE "Deposit" ADD COLUMN "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1;

-- Add depositDate nullable first, backfill existing rows from createdAt, then enforce NOT NULL.
-- No DB-level default: the application supplies depositDate on create (like Order.orderDate).
ALTER TABLE "Deposit" ADD COLUMN "depositDate" TIMESTAMP(3);
UPDATE "Deposit" SET "depositDate" = "createdAt" WHERE "depositDate" IS NULL;
ALTER TABLE "Deposit" ALTER COLUMN "depositDate" SET NOT NULL;

-- Index matches the summary/export deposit predicate: businessUnitId + source + depositDate range.
CREATE INDEX "Deposit_businessUnitId_source_depositDate_idx" ON "Deposit"("businessUnitId", "source", "depositDate");

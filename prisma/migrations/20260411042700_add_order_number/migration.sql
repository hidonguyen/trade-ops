-- BusinessUnit: order number mode config (MANUAL | AUTO)
ALTER TABLE "BusinessUnit" ADD COLUMN "orderNumberMode" TEXT NOT NULL DEFAULT 'MANUAL';

-- Order: add orderNumber (nullable first so we can backfill), backfill, then enforce NOT NULL
ALTER TABLE "Order" ADD COLUMN "orderNumber" TEXT;

-- Backfill existing orders with a temporary value derived from row id to guarantee uniqueness
-- within (businessUnitId, partyId). Format: TMP-<last 8 chars of id>.
UPDATE "Order" SET "orderNumber" = 'TMP-' || SUBSTRING("id" FROM 28 FOR 8);

ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;

-- Unique per (BU, party): two different parties can share the same orderNumber
CREATE UNIQUE INDEX "Order_businessUnitId_partyId_orderNumber_key"
  ON "Order"("businessUnitId", "partyId", "orderNumber");

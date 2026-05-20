-- Party multi-BU sharing via M2M.
-- Party.businessUnitId stays (origin/primary BU). Sharing read through M2M.

CREATE TABLE "PartyBusinessUnit" (
  "partyId"        TEXT NOT NULL,
  "businessUnitId" TEXT NOT NULL,
  CONSTRAINT "PartyBusinessUnit_pkey" PRIMARY KEY ("partyId", "businessUnitId")
);

ALTER TABLE "PartyBusinessUnit"
  ADD CONSTRAINT "PartyBusinessUnit_partyId_fkey"
  FOREIGN KEY ("partyId") REFERENCES "Party"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartyBusinessUnit"
  ADD CONSTRAINT "PartyBusinessUnit_businessUnitId_fkey"
  FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PartyBusinessUnit_businessUnitId_idx" ON "PartyBusinessUnit"("businessUnitId");

-- Backfill: every existing party gets one M2M row pointing at its origin BU,
-- preserving current visibility (a party stays visible in the BU that created it).
INSERT INTO "PartyBusinessUnit" ("partyId", "businessUnitId")
SELECT "id", "businessUnitId" FROM "Party"
ON CONFLICT DO NOTHING;

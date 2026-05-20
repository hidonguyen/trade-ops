-- Contact multi-BU sharing via M2M (mirrors PartyBusinessUnit).

CREATE TABLE "ContactBusinessUnit" (
  "contactId"      TEXT NOT NULL,
  "businessUnitId" TEXT NOT NULL,
  CONSTRAINT "ContactBusinessUnit_pkey" PRIMARY KEY ("contactId", "businessUnitId")
);

ALTER TABLE "ContactBusinessUnit"
  ADD CONSTRAINT "ContactBusinessUnit_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactBusinessUnit"
  ADD CONSTRAINT "ContactBusinessUnit_businessUnitId_fkey"
  FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ContactBusinessUnit_businessUnitId_idx" ON "ContactBusinessUnit"("businessUnitId");

-- Backfill: previously Contact was global, so every existing contact stays
-- visible in every active BU.
INSERT INTO "ContactBusinessUnit" ("contactId", "businessUnitId")
SELECT c."id", bu."id"
FROM "Contact" c CROSS JOIN "BusinessUnit" bu
WHERE bu."isActive" = true
ON CONFLICT DO NOTHING;

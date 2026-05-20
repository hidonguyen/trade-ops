-- Contact directory + link Transaction → Contact (Người Nộp/Nhận).
-- Plan: 260513-1158-party-multi-bu-contacts-copy / phase-01-schema.

-- 1. Contact table (no businessUnitId — multi-BU sharing handled later in phase 6/B).
CREATE TABLE "Contact" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "phone"     TEXT,
  "email"     TEXT,
  "taxId"     TEXT,
  "address"   TEXT,
  "notes"     TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contact_name_idx"     ON "Contact"("name");
CREATE INDEX "Contact_phone_idx"    ON "Contact"("phone");
CREATE INDEX "Contact_isActive_idx" ON "Contact"("isActive");

-- 2. Transaction.contactId — nullable, used on standalone RECEIPT/PAYMENT.
ALTER TABLE "Transaction" ADD COLUMN "contactId" TEXT;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Transaction_contactId_idx" ON "Transaction"("contactId");

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- Backfill REFUND-sourced deposits: deposits with a usage row created within 5s of deposit creation
-- where the linked transaction is a REFUND. This restricts to the auto-create path
-- (createDepositFromRefund creates deposit and usage in same $transaction).
UPDATE "Deposit" d
SET source = 'REFUND'
WHERE EXISTS (
  SELECT 1 FROM "DepositUsage" u
  JOIN "Transaction" t ON t.id = u."transactionId"
  WHERE u."depositId" = d.id
    AND u."amountOriginal" < 0
    AND t."paymentType" = 'REFUND'
    AND ABS(EXTRACT(EPOCH FROM (u."createdAt" - d."createdAt"))) < 5
);

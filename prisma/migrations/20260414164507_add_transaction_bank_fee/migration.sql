-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "bankFeeOriginal" DECIMAL(18,4),
ADD COLUMN     "bankFeeVnd" DECIMAL(18,4);

-- CreateIndex
CREATE INDEX "Transaction_businessUnitId_transactionDate_paymentMethod_idx" ON "Transaction"("businessUnitId", "transactionDate", "paymentMethod");

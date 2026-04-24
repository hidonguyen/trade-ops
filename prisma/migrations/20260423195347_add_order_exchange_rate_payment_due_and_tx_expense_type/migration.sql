-- AlterTable: add exchangeRate (NOT NULL DEFAULT 1) and paymentDueDate (nullable) to Order
ALTER TABLE "Order" ADD COLUMN "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1;
ALTER TABLE "Order" ADD COLUMN "paymentDueDate" TIMESTAMP(3);

-- AlterTable: add expenseTypeId (nullable FK) to Transaction
ALTER TABLE "Transaction" ADD COLUMN "expenseTypeId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_expenseTypeId_idx" ON "Transaction"("expenseTypeId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_expenseTypeId_fkey" FOREIGN KEY ("expenseTypeId") REFERENCES "ExpenseType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

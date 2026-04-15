-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "expenseTypeId" TEXT;

-- CreateIndex
CREATE INDEX "Order_expenseTypeId_idx" ON "Order"("expenseTypeId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_expenseTypeId_fkey" FOREIGN KEY ("expenseTypeId") REFERENCES "ExpenseType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

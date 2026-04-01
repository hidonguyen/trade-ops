// Deposit deduction and reversal — always call inside prisma.$transaction()
import Decimal from "decimal.js";

// Deduct amountOriginal from a deposit and record usage linked to a transaction
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deductDeposit(
  tx: any,
  depositId: string,
  amountOriginal: string,
  transactionId: string
) {
  const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw new Error("Deposit not found");

  const remaining = new Decimal(deposit.remainingOriginal.toString());
  const deductAmount = new Decimal(amountOriginal);

  if (remaining.lessThan(deductAmount)) {
    throw new Error("Insufficient deposit balance");
  }

  await tx.deposit.update({
    where: { id: depositId },
    data: { remainingOriginal: { decrement: deductAmount } },
  });

  await tx.depositUsage.create({
    data: { depositId, transactionId, amountOriginal: deductAmount },
  });
}

// Reverse all deposit deductions linked to a transaction (used on delete)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function reverseDepositDeduction(tx: any, transactionId: string) {
  const usages = await tx.depositUsage.findMany({ where: { transactionId } });
  for (const usage of usages) {
    await tx.deposit.update({
      where: { id: usage.depositId },
      data: {
        remainingOriginal: { increment: new Decimal(usage.amountOriginal.toString()) },
      },
    });
    await tx.depositUsage.delete({ where: { id: usage.id } });
  }
}

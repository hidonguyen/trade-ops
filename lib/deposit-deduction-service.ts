// Deposit deduction and reversal — always call inside prisma.$transaction()
// DepositUsage.amountOriginal uses SIGNED convention:
//   positive = deduction (PAYMENT + DEPOSIT)
//   negative = credit      (REFUND + DEPOSIT, existing or auto-created)
// reverseDepositDeduction undoes either direction.
import Decimal from "decimal.js";
import { MSG } from "@/lib/messages";

// Deduct amountOriginal from a deposit and record usage linked to a transaction
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deductDeposit(
  tx: any,
  depositId: string,
  amountOriginal: string,
  transactionId: string,
  currencyId?: string
) {
  const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw new Error(MSG.depositNotFound);

  // Validate currency match — deposit and transaction must use same currency
  if (currencyId && deposit.currencyId !== currencyId) {
    throw new Error(MSG.depositCurrencyMismatch);
  }

  const remaining = new Decimal(deposit.remainingOriginal.toString());
  const deductAmount = new Decimal(amountOriginal);

  if (remaining.lessThan(deductAmount)) {
    throw new Error(MSG.insufficientDeposit);
  }

  await tx.deposit.update({
    where: { id: depositId },
    data: { remainingOriginal: { decrement: deductAmount } },
  });

  await tx.depositUsage.create({
    data: { depositId, transactionId, amountOriginal: deductAmount },
  });
}

// Credit an existing deposit (REFUND + DEPOSIT, user picked existing deposit).
// Increments both amountOriginal (total ever deposited) and remainingOriginal (available).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function creditDeposit(
  tx: any,
  depositId: string,
  amountOriginal: string,
  transactionId: string,
  currencyId?: string
) {
  const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw new Error(MSG.depositNotFound);

  // Validate currency match — deposit and transaction must use same currency
  if (currencyId && deposit.currencyId !== currencyId) {
    throw new Error(MSG.depositCurrencyMismatch);
  }

  const amount = new Decimal(amountOriginal);
  await tx.deposit.update({
    where: { id: depositId },
    data: {
      remainingOriginal: { increment: amount },
      amountOriginal: { increment: amount },
    },
  });

  // Signed negative = credit (audit trail; enables reverse on delete)
  await tx.depositUsage.create({
    data: { depositId, transactionId, amountOriginal: amount.negated() },
  });
}

// Auto-create a deposit from a REFUND transaction when party has no deposit yet
// (or user chose "create new"). Amount seeds both totals. Returns the new deposit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createDepositFromRefund(
  tx: any,
  args: {
    partyId: string;
    businessUnitId: string;
    currencyId: string;
    amountOriginal: string;
    transactionId: string;
    notes?: string | null;
  }
) {
  const amount = new Decimal(args.amountOriginal);
  const deposit = await tx.deposit.create({
    data: {
      partyId: args.partyId,
      businessUnitId: args.businessUnitId,
      currencyId: args.currencyId,
      amountOriginal: amount,
      remainingOriginal: amount,
      source: "REFUND",
      notes: args.notes ?? null,
    },
  });
  await tx.depositUsage.create({
    data: {
      depositId: deposit.id,
      transactionId: args.transactionId,
      amountOriginal: amount.negated(),
    },
  });
  return deposit;
}

// Reverse all deposit operations linked to a transaction (used on delete/patch).
// Positive usage  → was a deduction → increment remaining (restore available funds)
// Negative usage  → was a credit    → decrement both remaining and total
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function reverseDepositDeduction(tx: any, transactionId: string) {
  const usages = await tx.depositUsage.findMany({ where: { transactionId } });
  for (const usage of usages) {
    const amt = new Decimal(usage.amountOriginal.toString());
    if (amt.isNegative()) {
      // Reverse a credit: shrink both buckets by |amt|
      const abs = amt.abs();
      await tx.deposit.update({
        where: { id: usage.depositId },
        data: {
          remainingOriginal: { decrement: abs },
          amountOriginal: { decrement: abs },
        },
      });
    } else {
      // Reverse a deduction: restore available balance
      await tx.deposit.update({
        where: { id: usage.depositId },
        data: { remainingOriginal: { increment: amt } },
      });
    }
    await tx.depositUsage.delete({ where: { id: usage.id } });
  }
}

// Apply the correct deposit operation for a transaction based on paymentType.
// Used by POST/PATCH routes to keep logic DRY. Accepts nullable depositId;
// when null and paymentType=REFUND, auto-creates a new deposit using partyContext.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyDepositOperation(
  tx: any,
  args: {
    paymentType: "PAYMENT" | "REFUND";
    depositId: string | null;
    amountOriginal: string;
    transactionId: string;
    // Currency of the transaction — used to validate deposit currency match
    currencyId?: string;
    // Required when depositId is null and paymentType is REFUND (auto-create path)
    partyContext?: { partyId: string; businessUnitId: string; currencyId: string };
    // Optional notes propagated to auto-created Deposit (default empty)
    notes?: string | null;
  }
) {
  const txCurrencyId = args.currencyId ?? args.partyContext?.currencyId;
  if (args.paymentType === "PAYMENT") {
    if (!args.depositId) throw new Error(MSG.depositIdRequiredPayment);
    await deductDeposit(tx, args.depositId, args.amountOriginal, args.transactionId, txCurrencyId);
    return;
  }
  // REFUND
  if (args.depositId) {
    await creditDeposit(tx, args.depositId, args.amountOriginal, args.transactionId, txCurrencyId);
    return;
  }
  if (!args.partyContext) {
    throw new Error(MSG.partyIdRequiredRefund);
  }
  await createDepositFromRefund(tx, {
    ...args.partyContext,
    amountOriginal: args.amountOriginal,
    transactionId: args.transactionId,
    notes: args.notes ?? null,
  });
}

// Shared order aggregate computations — used by report routes + list API
// Computes adjustmentTotal, effectiveValue, balance, paidAmount, refundedAmount from raw transactions
import Decimal from "decimal.js";

interface RawTransaction {
  paymentType: string;
  amountOriginal: { toString(): string } | string | number;
  transactionDate: Date;
  notes?: string | null;
}

export interface OrderAggregates {
  adjustmentTotal: number; // signed sum of ADJUSTMENT transactions
  effectiveValue: number;  // amountOriginal + adjustmentTotal
  paidAmount: number;      // sum of PAYMENT transactions (gross)
  refundedAmount: number;  // sum of REFUND transactions (gross)
  netPaidAmount: number;   // paidAmount - refundedAmount
  balanceOriginal: number; // max(effectiveValue - paidAmount + refundedAmount, 0)
}

/**
 * Compute financial aggregates for a single order given its transactions.
 * @param amountOriginal - order face value (Decimal-serialised string or number)
 * @param transactions - all transactions on the order
 */
export function computeOrderAggregates(
  amountOriginal: { toString(): string } | string | number,
  transactions: RawTransaction[]
): OrderAggregates {
  let adjustmentTotal = new Decimal(0);
  let paidAmount = new Decimal(0);
  let refundedAmount = new Decimal(0);

  for (const tx of transactions) {
    const amt = new Decimal(tx.amountOriginal.toString());
    if (tx.paymentType === "ADJUSTMENT") {
      adjustmentTotal = adjustmentTotal.plus(amt);
    } else if (tx.paymentType === "PAYMENT") {
      paidAmount = paidAmount.plus(amt);
    } else if (tx.paymentType === "REFUND") {
      refundedAmount = refundedAmount.plus(amt);
    }
  }

  const orderAmt = new Decimal(amountOriginal.toString());
  const effectiveValue = orderAmt.plus(adjustmentTotal);
  const netPaidAmount = paidAmount.minus(refundedAmount);
  const balanceOriginal = Decimal.max(
    effectiveValue.minus(paidAmount).plus(refundedAmount),
    new Decimal(0)
  );

  return {
    adjustmentTotal: adjustmentTotal.toNumber(),
    effectiveValue: effectiveValue.toNumber(),
    paidAmount: paidAmount.toNumber(),
    refundedAmount: refundedAmount.toNumber(),
    netPaidAmount: netPaidAmount.toNumber(),
    balanceOriginal: balanceOriginal.toNumber(),
  };
}

/**
 * Extract PAYMENT + REFUND transactions sorted by date.
 * REFUND amounts returned as negative so column sums equal net paid (paid − refund).
 */
export function extractPaymentsAndRefunds(
  transactions: RawTransaction[]
): Array<{ transactionDate: Date; amountOriginal: number; paymentType: "PAYMENT" | "REFUND"; notes?: string | null }> {
  return transactions
    .filter((tx) => tx.paymentType === "PAYMENT" || tx.paymentType === "REFUND")
    .sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime())
    .map((tx) => {
      const amt = new Decimal(tx.amountOriginal.toString()).toNumber();
      return {
        transactionDate: tx.transactionDate,
        amountOriginal: tx.paymentType === "REFUND" ? -amt : amt,
        paymentType: tx.paymentType as "PAYMENT" | "REFUND",
        notes: tx.notes ?? null,
      };
    });
}

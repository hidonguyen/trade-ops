// Recalculate and persist order status based on its transactions
// Must be called inside a prisma.$transaction() block
import Decimal from "decimal.js";

// Accepts a Prisma transaction client (not full PrismaClient)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recalculateOrderStatus(orderId: string, tx: any) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { transactions: true },
  });
  if (!order) throw new Error("Order not found");

  // Bucket 1: PAYMENT transactions — sum to paidAmount (persisted)
  const paidAmount = order.transactions
    .filter((t: any) => t.paymentType === "PAYMENT")
    .reduce(
      (sum: Decimal, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())),
      new Decimal(0)
    );

  // Bucket 2: REFUND transactions — sum to refundedAmount (persisted)
  const refundedAmount = order.transactions
    .filter((t: any) => t.paymentType === "REFUND")
    .reduce(
      (sum: Decimal, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())),
      new Decimal(0)
    );

  // Bucket 3: ADJUSTMENT transactions — signed sum modifies order value side (NOT persisted to paidAmount)
  const adjTotal = order.transactions
    .filter((t: any) => t.paymentType === "ADJUSTMENT")
    .reduce(
      (sum: Decimal, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())),
      new Decimal(0)
    );

  const netPaid = paidAmount.minus(refundedAmount);
  const orderAmount = new Decimal(order.amountOriginal.toString());
  // effectiveValue = original order amount + signed sum of all adjustments
  // Adjustments modify the "what we expect" side, not the "what we received" side
  const effectiveValue = orderAmount.plus(adjTotal);

  let status = "UNPAID";
  if (netPaid.lessThanOrEqualTo(0) && refundedAmount.greaterThan(0)) {
    status = "REFUNDED";
  } else if (refundedAmount.greaterThan(0) && netPaid.lessThan(effectiveValue)) {
    status = "PARTIAL_REFUNDED";
  } else if (netPaid.greaterThanOrEqualTo(effectiveValue)) {
    status = "PAID";
  } else if (netPaid.greaterThan(0)) {
    status = "PARTIAL_PAID";
  }

  // paidAmount and refundedAmount are persisted as-is (PAYMENT/REFUND only)
  // Adjustments are transient — recalculated each time from transactions
  return tx.order.update({
    where: { id: orderId },
    data: { status, paidAmount, refundedAmount },
  });
}

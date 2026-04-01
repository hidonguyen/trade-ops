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

  const paidAmount = order.transactions
    .filter((t: any) => t.paymentType === "PAYMENT")
    .reduce(
      (sum: Decimal, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())),
      new Decimal(0)
    );

  const refundedAmount = order.transactions
    .filter((t: any) => t.paymentType === "REFUND")
    .reduce(
      (sum: Decimal, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())),
      new Decimal(0)
    );

  const netPaid = paidAmount.minus(refundedAmount);
  const orderAmount = new Decimal(order.amountOriginal.toString());

  let status = "UNPAID";
  if (netPaid.lessThanOrEqualTo(0) && refundedAmount.greaterThan(0)) {
    status = "REFUNDED";
  } else if (refundedAmount.greaterThan(0) && netPaid.lessThan(orderAmount)) {
    status = "PARTIAL_REFUNDED";
  } else if (netPaid.greaterThanOrEqualTo(orderAmount)) {
    status = "PAID";
  } else if (netPaid.greaterThan(0)) {
    status = "PARTIAL_PAID";
  }

  return tx.order.update({
    where: { id: orderId },
    data: { status, paidAmount, refundedAmount },
  });
}

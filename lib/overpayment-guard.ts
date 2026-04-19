// Server-side guard for order-linked transactions:
// - PAYMENT: reject if netPaid would exceed orderAmount
// - REFUND: reject if total refunds would exceed total payments
// Must be called inside prisma.$transaction() block
// Uses SELECT FOR UPDATE to prevent concurrent race conditions
import Decimal from "decimal.js";
import { MSG } from "@/lib/messages";

export async function checkOverpayment(
  tx: any,
  orderId: string,
  newAmountOriginal: string,
  paymentType: string,
  excludeTxId?: string
) {
  if (paymentType !== "PAYMENT" && paymentType !== "REFUND") return;

  // Row-level lock on order to prevent concurrent race condition (TOCTOU)
  await tx.$queryRawUnsafe(`SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`, orderId);

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { amountOriginal: true, transactions: { select: { id: true, amountOriginal: true, paymentType: true } } },
  });
  if (!order) throw new Error(MSG.orderNotFound);

  const existingPaid = order.transactions
    .filter((t: any) => t.paymentType === "PAYMENT" && t.id !== excludeTxId)
    .reduce((sum: Decimal, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

  const existingRefunded = order.transactions
    .filter((t: any) => t.paymentType === "REFUND" && t.id !== excludeTxId)
    .reduce((sum: Decimal, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

  const newAmount = new Decimal(newAmountOriginal);

  if (paymentType === "PAYMENT") {
    // Check: netPaid + newPayment <= orderAmount
    const projectedNet = existingPaid.minus(existingRefunded).plus(newAmount);
    const orderAmount = new Decimal(order.amountOriginal.toString());
    if (projectedNet.greaterThan(orderAmount)) {
      throw new Error(MSG.overpaymentExceeded);
    }
  } else {
    // REFUND: totalRefunds + newRefund <= totalPaid
    const projectedRefunds = existingRefunded.plus(newAmount);
    if (projectedRefunds.greaterThan(existingPaid)) {
      throw new Error(MSG.overRefundExceeded);
    }
  }
}

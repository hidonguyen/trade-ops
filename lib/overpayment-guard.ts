// Server-side guard for order-linked transactions:
// - PAYMENT: reject if netPaid would exceed effectiveValue (orderAmount + adjustments)
// - REFUND: reject if total refunds would exceed total payments
// - ADJUSTMENT: no ceiling check (signed, can be positive or negative)
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
  // ADJUSTMENT type has no ceiling — skip guard entirely
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

  // Compute signed sum of ADJUSTMENT transactions — modifies effective ceiling
  const adjTotal = order.transactions
    .filter((t: any) => t.paymentType === "ADJUSTMENT")
    .reduce((sum: Decimal, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

  // effectiveValue = orderAmount + Σ(adjustments) — this is the ceiling for payments
  const orderAmount = new Decimal(order.amountOriginal.toString());
  const effectiveValue = orderAmount.plus(adjTotal);

  const newAmount = new Decimal(newAmountOriginal);

  if (paymentType === "PAYMENT") {
    // Check: netPaid + newPayment <= effectiveValue
    const projectedNet = existingPaid.minus(existingRefunded).plus(newAmount);
    if (projectedNet.greaterThan(effectiveValue)) {
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

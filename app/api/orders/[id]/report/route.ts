// Order financial summary report — aggregates payment/refund totals
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";
import { MSG } from "@/lib/messages";
import { withCache } from "@/lib/cache/with-cache";
import { TAG, TTL, orderReportKey } from "@/lib/cache/keys";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id } = await params;

  try {
    const report = await withCache(
      { key: orderReportKey(id), tags: [TAG.order(id)], ttlMs: TTL.orderReport },
      async () => {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        party: { select: { id: true, name: true, type: true } },
        currency: { select: { id: true, code: true, symbol: true } },
        businessUnit: { select: { id: true, code: true, name: true } },
        expenseType: { select: { id: true, name: true, isActive: true } },
        transactions: {
          include: {
            currency: { select: { id: true, code: true, symbol: true } },
            depositUsages: { include: { deposit: { select: { id: true, amountOriginal: true } } } },
          },
          orderBy: { transactionDate: "asc" },
        },
      },
    });

    if (!order) return null;

    // Compute summary using Decimal for precision
    const payments = order.transactions.filter((t: any) => t.paymentType === "PAYMENT");
    const refunds = order.transactions.filter((t: any) => t.paymentType === "REFUND");
    const adjustments = order.transactions.filter((t: any) => t.paymentType === "ADJUSTMENT");

    const totalPaidOriginal = payments.reduce(
      (sum: any, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())),
      new Decimal(0)
    );
    const totalPaidVnd = payments.reduce(
      (sum: any, t: any) => sum.plus(new Decimal(t.amountVnd.toString())),
      new Decimal(0)
    );
    const totalRefundedOriginal = refunds.reduce(
      (sum: any, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())),
      new Decimal(0)
    );
    const totalRefundedVnd = refunds.reduce(
      (sum: any, t: any) => sum.plus(new Decimal(t.amountVnd.toString())),
      new Decimal(0)
    );

    // Signed sum of adjustments — modifies effective order value, NOT the paid side
    const adjustmentTotalOriginal = adjustments.reduce(
      (sum: any, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())),
      new Decimal(0)
    );

    const orderAmount = new Decimal(order.amountOriginal.toString());
    const netPaidOriginal = totalPaidOriginal.minus(totalRefundedOriginal);

    // effectiveValueOriginal = orderAmount + Σ(adjustments)
    // Adjustments change "what customer owes", not "what they paid"
    const effectiveValueOriginal = orderAmount.plus(adjustmentTotalOriginal);

    // balanceOriginal = max(effectiveValue - paid + refunded, 0)
    // Explanation: effectiveValue is what is owed; paid reduces it; refunded adds back (customer gets money back, still owes that portion)
    const balanceOriginal = Decimal.max(
      effectiveValueOriginal.minus(totalPaidOriginal).plus(totalRefundedOriginal),
      new Decimal(0)
    );

    // Payment breakdown by method (PAYMENT-type only)
    const depositPayments = order.transactions
      .filter((t: any) => t.paymentMethod === "DEPOSIT" && t.paymentType === "PAYMENT")
      .reduce((sum: any, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

    const bankPayments = order.transactions
      .filter((t: any) => t.paymentMethod === "BANK" && t.paymentType === "PAYMENT")
      .reduce((sum: any, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

    // Refund breakdown by method (REFUND-type only) — symmetric to payment breakdown
    const depositRefunds = order.transactions
      .filter((t: any) => t.paymentMethod === "DEPOSIT" && t.paymentType === "REFUND")
      .reduce((sum: any, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

    const bankRefunds = order.transactions
      .filter((t: any) => t.paymentMethod === "BANK" && t.paymentType === "REFUND")
      .reduce((sum: any, t: any) => sum.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

    return {
      order: {
        id: order.id,
        type: order.type,
        status: order.status,
        orderNumber: order.orderNumber,
        amountOriginal: order.amountOriginal,
        exchangeRate: order.exchangeRate,
        paymentDueDate: order.paymentDueDate,
        orderDate: order.orderDate,
        notes: order.notes,
        party: order.party,
        currency: order.currency,
        businessUnit: order.businessUnit,
        expenseType: order.expenseType ?? null,
      },
      summary: {
        orderAmountOriginal: orderAmount.toFixed(4),
        adjustmentTotalOriginal: adjustmentTotalOriginal.toFixed(4),
        effectiveValueOriginal: effectiveValueOriginal.toFixed(4),
        totalPaidOriginal: totalPaidOriginal.toFixed(4),
        totalPaidVnd: totalPaidVnd.toFixed(4),
        totalRefundedOriginal: totalRefundedOriginal.toFixed(4),
        totalRefundedVnd: totalRefundedVnd.toFixed(4),
        netPaidOriginal: netPaidOriginal.toFixed(4),
        balanceOriginal: balanceOriginal.toFixed(4),
        bankPaymentsOriginal: bankPayments.toFixed(4),
        depositPaymentsOriginal: depositPayments.toFixed(4),
        bankRefundsOriginal: bankRefunds.toFixed(4),
        depositRefundsOriginal: depositRefunds.toFixed(4),
        transactionCount: order.transactions.length,
      },
      transactions: order.transactions,
    };
      }
    );

    if (!report) {
      return Response.json(apiResponse(false, undefined, MSG.orderNotFound), { status: 404 });
    }

    // Access check after cache: all viewers of the same order share cache; non-authorized get 403 on this branch.
    const module = report.order.type === "SALE" ? "SALE" : "PURCHASE";
    if (!checkAccess(session.user.roles, "GET", module)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    return Response.json(apiResponse(true, report));
  } catch (error) {
    console.error("GET /api/orders/[id]/report error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

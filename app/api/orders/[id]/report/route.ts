// Order financial summary report — aggregates payment/refund totals
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        party: { select: { id: true, name: true, type: true } },
        currency: { select: { id: true, code: true, symbol: true } },
        businessUnit: { select: { id: true, code: true, name: true } },
        transactions: {
          include: {
            currency: { select: { id: true, code: true, symbol: true } },
            depositUsages: { include: { deposit: { select: { id: true, amountOriginal: true } } } },
          },
          orderBy: { transactionDate: "asc" },
        },
      },
    });

    if (!order) {
      return Response.json(apiResponse(false, undefined, "Order not found"), { status: 404 });
    }

    const module = order.type === "SALE" ? "SALE" : "PURCHASE";
    if (!checkAccess(session.user.roles, "GET", module)) {
      return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
    }

    // Compute summary using Decimal for precision
    const payments = order.transactions.filter((t) => t.paymentType === "PAYMENT");
    const refunds = order.transactions.filter((t) => t.paymentType === "REFUND");

    const totalPaidOriginal = payments.reduce(
      (sum, t) => sum.plus(new Decimal(t.amountOriginal.toString())),
      new Decimal(0)
    );
    const totalPaidVnd = payments.reduce(
      (sum, t) => sum.plus(new Decimal(t.amountVnd.toString())),
      new Decimal(0)
    );
    const totalRefundedOriginal = refunds.reduce(
      (sum, t) => sum.plus(new Decimal(t.amountOriginal.toString())),
      new Decimal(0)
    );
    const totalRefundedVnd = refunds.reduce(
      (sum, t) => sum.plus(new Decimal(t.amountVnd.toString())),
      new Decimal(0)
    );

    const orderAmount = new Decimal(order.amountOriginal.toString());
    const netPaidOriginal = totalPaidOriginal.minus(totalRefundedOriginal);
    const balanceOriginal = orderAmount.minus(netPaidOriginal);

    const depositPayments = order.transactions
      .filter((t) => t.paymentMethod === "DEPOSIT")
      .reduce((sum, t) => sum.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

    const bankPayments = order.transactions
      .filter((t) => t.paymentMethod === "BANK" && t.paymentType === "PAYMENT")
      .reduce((sum, t) => sum.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

    const report = {
      order: {
        id: order.id,
        type: order.type,
        status: order.status,
        amountOriginal: order.amountOriginal,
        orderDate: order.orderDate,
        notes: order.notes,
        party: order.party,
        currency: order.currency,
        businessUnit: order.businessUnit,
      },
      summary: {
        orderAmountOriginal: orderAmount.toFixed(4),
        totalPaidOriginal: totalPaidOriginal.toFixed(4),
        totalPaidVnd: totalPaidVnd.toFixed(4),
        totalRefundedOriginal: totalRefundedOriginal.toFixed(4),
        totalRefundedVnd: totalRefundedVnd.toFixed(4),
        netPaidOriginal: netPaidOriginal.toFixed(4),
        balanceOriginal: balanceOriginal.toFixed(4),
        bankPaymentsOriginal: bankPayments.toFixed(4),
        depositPaymentsOriginal: depositPayments.toFixed(4),
        transactionCount: order.transactions.length,
      },
      transactions: order.transactions,
    };

    return Response.json(apiResponse(true, report));
  } catch (error) {
    console.error("GET /api/orders/[id]/report error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

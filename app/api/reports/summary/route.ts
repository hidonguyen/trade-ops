// Summary report — detailed per-order debt tracking + standalone transactions
// 4 sections: customer receipts, other receipts, supplier payments, other payments
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Decimal from "decimal.js";
import { MSG } from "@/lib/messages";

const querySchema = z.object({
  businessUnitId: z.string().uuid(),
  dateFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "GET", "DASHBOARD")) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, parsed.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  const { businessUnitId, dateFrom, dateTo } = parsed.data;
  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  toDate.setHours(23, 59, 59, 999);

  try {
    // Orders with PAYMENT transactions in the report period
    const ordersWithTxs = await prisma.order.findMany({
      where: {
        businessUnitId,
        transactions: {
          some: {
            paymentType: "PAYMENT",
            transactionDate: { gte: fromDate, lte: toDate },
          },
        },
      },
      include: {
        party: { select: { name: true } },
        currency: { select: { code: true, symbol: true } },
        transactions: {
          where: { paymentType: "PAYMENT" },
          select: { amountOriginal: true, transactionDate: true },
        },
      },
      orderBy: { orderDate: "asc" },
    });

    // Compute debt rows per order
    function buildDebtRows(orders: typeof ordersWithTxs) {
      return orders.map((order) => {
        const orderAmt = new Decimal(order.amountOriginal.toString());

        // Sum payments before period
        const paidBefore = order.transactions
          .filter((t) => t.transactionDate < fromDate)
          .reduce((s, t) => s.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

        // Sum payments in period
        const paidInPeriod = order.transactions
          .filter((t) => t.transactionDate >= fromDate && t.transactionDate <= toDate)
          .reduce((s, t) => s.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

        const priorDebt = Decimal.max(orderAmt.minus(paidBefore), new Decimal(0));
        const remainingDebt = Decimal.max(orderAmt.minus(paidBefore).minus(paidInPeriod), new Decimal(0));

        return {
          orderId: order.id,
          partyName: order.party.name,
          orderNumber: order.orderNumber,
          orderDate: order.orderDate.toISOString(),
          currencyCode: order.currency.code,
          currencySymbol: order.currency.symbol,
          priorDebt: priorDebt.toFixed(4),
          periodPayment: paidInPeriod.toFixed(4),
          remainingDebt: remainingDebt.toFixed(4),
          notes: order.notes,
        };
      });
    }

    const saleOrders = ordersWithTxs.filter((o) => o.type === "SALE");
    const purchaseOrders = ordersWithTxs.filter((o) => o.type === "PURCHASE");

    // Standalone transactions in period
    const [receipts, payments] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          businessUnitId,
          orderId: null,
          type: "RECEIPT",
          transactionDate: { gte: fromDate, lte: toDate },
        },
        include: { currency: { select: { code: true, symbol: true } } },
        orderBy: { transactionDate: "asc" },
      }),
      prisma.transaction.findMany({
        where: {
          businessUnitId,
          orderId: null,
          type: "PAYMENT",
          transactionDate: { gte: fromDate, lte: toDate },
        },
        include: { currency: { select: { code: true, symbol: true } } },
        orderBy: { transactionDate: "asc" },
      }),
    ]);

    function buildStandaloneRows(txs: typeof receipts) {
      return txs.map((t) => ({
        id: t.id,
        transactionDate: t.transactionDate.toISOString(),
        amountOriginal: t.amountOriginal.toString(),
        currencyCode: t.currency.code,
        currencySymbol: t.currency.symbol,
        paymentMethod: t.paymentMethod,
        bankReference: t.bankReference,
        notes: t.notes,
      }));
    }

    return Response.json(apiResponse(true, {
      customerReceipts: buildDebtRows(saleOrders),
      otherReceipts: buildStandaloneRows(receipts),
      supplierPayments: buildDebtRows(purchaseOrders),
      otherPayments: buildStandaloneRows(payments),
    }));
  } catch (error) {
    console.error("GET /api/reports/summary error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

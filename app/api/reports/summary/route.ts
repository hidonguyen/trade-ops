// Summary report — sales/purchase totals + receivable/payable by currency
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

// Orders that are not fully settled (receivable or payable)
const UNPAID_STATUSES = ["UNPAID", "PARTIAL_PAID", "PARTIAL_REFUNDED"];

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
    const [saleOrders, purchaseOrders, openSales, openPurchases] = await Promise.all([
      // Total sales in period
      prisma.order.findMany({
        where: {
          businessUnitId,
          type: "SALE",
          orderDate: { gte: fromDate, lte: toDate },
        },
        select: { amountOriginal: true, currencyId: true, currency: { select: { code: true, symbol: true } } },
      }),
      // Total purchases in period
      prisma.order.findMany({
        where: {
          businessUnitId,
          type: "PURCHASE",
          orderDate: { gte: fromDate, lte: toDate },
        },
        select: { amountOriginal: true, currencyId: true, currency: { select: { code: true, symbol: true } } },
      }),
      // Open receivables (unpaid/partial SALE orders — no date filter, reflects current state)
      prisma.order.findMany({
        where: { businessUnitId, type: "SALE", status: { in: UNPAID_STATUSES } },
        select: {
          amountOriginal: true,
          paidAmount: true,
          refundedAmount: true,
          currencyId: true,
          currency: { select: { code: true, symbol: true } },
        },
      }),
      // Open payables (unpaid/partial PURCHASE orders)
      prisma.order.findMany({
        where: { businessUnitId, type: "PURCHASE", status: { in: UNPAID_STATUSES } },
        select: {
          amountOriginal: true,
          paidAmount: true,
          refundedAmount: true,
          currencyId: true,
          currency: { select: { code: true, symbol: true } },
        },
      }),
    ]);

    // Aggregate by currency helper
    function sumByCurrency(
      rows: Array<{ amountOriginal: { toString(): string }; currency: { code: string; symbol: string } }>
    ) {
      const map = new Map<string, { code: string; symbol: string; total: Decimal }>();
      for (const r of rows) {
        const { code, symbol } = r.currency;
        if (!map.has(code)) map.set(code, { code, symbol, total: new Decimal(0) });
        map.get(code)!.total = map.get(code)!.total.plus(new Decimal(r.amountOriginal.toString()));
      }
      return Array.from(map.values()).map((e) => ({ code: e.code, symbol: e.symbol, total: e.total.toFixed(4) }));
    }

    // Remaining = amountOriginal - paidAmount + refundedAmount
    function remainingByCurrency(
      rows: Array<{
        amountOriginal: { toString(): string };
        paidAmount: { toString(): string };
        refundedAmount: { toString(): string };
        currency: { code: string; symbol: string };
      }>
    ) {
      const map = new Map<string, { code: string; symbol: string; total: Decimal }>();
      for (const r of rows) {
        const { code, symbol } = r.currency;
        if (!map.has(code)) map.set(code, { code, symbol, total: new Decimal(0) });
        const remaining = new Decimal(r.amountOriginal.toString())
          .minus(new Decimal(r.paidAmount.toString()))
          .plus(new Decimal(r.refundedAmount.toString()));
        map.get(code)!.total = map.get(code)!.total.plus(remaining);
      }
      return Array.from(map.values()).map((e) => ({ code: e.code, symbol: e.symbol, total: e.total.toFixed(4) }));
    }

    return Response.json(
      apiResponse(true, {
        totalSales: sumByCurrency(saleOrders),
        totalPurchases: sumByCurrency(purchaseOrders),
        totalReceivable: remainingByCurrency(openSales),
        totalPayable: remainingByCurrency(openPurchases),
      })
    );
  } catch (error) {
    console.error("GET /api/reports/summary error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

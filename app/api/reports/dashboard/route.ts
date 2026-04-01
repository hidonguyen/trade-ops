// Dashboard KPI endpoint — receivable, payable, recent tx count, deposit balances
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Decimal from "decimal.js";

const querySchema = z.object({
  businessUnitId: z.string().uuid(),
});

const UNPAID_STATUSES = ["UNPAID", "PARTIAL_PAID", "PARTIAL_REFUNDED"];

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "GET", "DASHBOARD")) {
    return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return Response.json(
      apiResponse(false, undefined, "Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  const { businessUnitId } = parsed.data;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const [openSales, openPurchases, recentTxCount, deposits] = await Promise.all([
      // Open SALE orders — for receivable KPI
      prisma.order.findMany({
        where: { businessUnitId, type: "SALE", status: { in: UNPAID_STATUSES } },
        select: {
          amountOriginal: true,
          paidAmount: true,
          refundedAmount: true,
          currency: { select: { code: true, symbol: true } },
        },
      }),
      // Open PURCHASE orders — for payable KPI
      prisma.order.findMany({
        where: { businessUnitId, type: "PURCHASE", status: { in: UNPAID_STATUSES } },
        select: {
          amountOriginal: true,
          paidAmount: true,
          refundedAmount: true,
          currency: { select: { code: true, symbol: true } },
        },
      }),
      // Transaction count last 30 days
      prisma.transaction.count({
        where: {
          businessUnitId,
          transactionDate: { gte: thirtyDaysAgo },
        },
      }),
      // Deposit balances grouped — use aggregate per currency
      prisma.deposit.groupBy({
        by: ["currencyId"],
        where: { businessUnitId, remainingOriginal: { gt: 0 } },
        _sum: { remainingOriginal: true },
      }),
    ]);

    // Compute remaining per currency: amountOriginal - paidAmount + refundedAmount
    function calcRemaining(
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
        const rem = new Decimal(r.amountOriginal.toString())
          .minus(new Decimal(r.paidAmount.toString()))
          .plus(new Decimal(r.refundedAmount.toString()));
        map.get(code)!.total = map.get(code)!.total.plus(rem);
      }
      return Array.from(map.values()).map((e) => ({
        code: e.code,
        symbol: e.symbol,
        total: e.total.toFixed(4),
      }));
    }

    // Resolve currency details for deposit aggregates
    const currencyIds = deposits.map((d) => d.currencyId);
    const currencies =
      currencyIds.length > 0
        ? await prisma.currency.findMany({
            where: { id: { in: currencyIds } },
            select: { id: true, code: true, symbol: true },
          })
        : [];
    const currencyById = new Map(currencies.map((c) => [c.id, c]));

    const depositBalances = deposits.map((d) => {
      const cur = currencyById.get(d.currencyId);
      return {
        currencyId: d.currencyId,
        code: cur?.code ?? "?",
        symbol: cur?.symbol ?? "",
        total: (d._sum.remainingOriginal ?? 0).toString(),
      };
    });

    return Response.json(
      apiResponse(true, {
        totalReceivable: calcRemaining(openSales),
        totalPayable: calcRemaining(openPurchases),
        recentTransactionCount: recentTxCount,
        depositBalances,
      })
    );
  } catch (error) {
    console.error("GET /api/reports/dashboard error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

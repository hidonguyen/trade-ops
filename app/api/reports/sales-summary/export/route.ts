// Sales summary Excel export — GET /api/reports/sales-summary/export
// Returns 11-column grouped summary workbook (.xlsx) for SALE orders in a date range
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MSG } from "@/lib/messages";
import { exportSalesSummary, SaleOrderForExport } from "@/lib/excel-order-reports-service";
import { buildReportFilename } from "@/lib/excel-report-utils";
import { computeOrderAggregates, extractPaymentsAndRefunds } from "@/lib/order-aggregates";

const querySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateFrom must be YYYY-MM-DD"),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateTo must be YYYY-MM-DD"),
  businessUnitId: z.string().optional(),
});

const MAX_DAYS = 366;

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "GET", "SALE")) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed),
      { status: 400 }
    );
  }

  const { dateFrom, dateTo, businessUnitId } = parsed.data;
  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  toDate.setHours(23, 59, 59, 999);

  // Cap range at 366 days
  const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
  if (diffDays > MAX_DAYS) {
    return Response.json(
      apiResponse(false, undefined, `Khoảng thời gian tối đa là ${MAX_DAYS} ngày`),
      { status: 400 }
    );
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        type: "SALE",
        ...(businessUnitId ? { businessUnitId } : {}),
        OR: [
          { orderDate: { gte: fromDate, lte: toDate } },
          { transactions: { some: { transactionDate: { gte: fromDate, lte: toDate } } } },
        ],
      },
      include: {
        party: { select: { name: true } },
        currency: { select: { code: true } },
        businessUnit: { select: { code: true } },
        transactions: {
          select: {
            paymentType: true,
            amountOriginal: true,
            transactionDate: true,
            notes: true,
          },
        },
      },
      orderBy: { orderDate: "asc" },
    });

    const mapped: SaleOrderForExport[] = orders.map((o) => {
      const agg = computeOrderAggregates(o.amountOriginal, o.transactions);
      return {
        businessUnitCode: o.businessUnit.code,
        partyName: o.party.name,
        orderNumber: o.orderNumber,
        orderDate: o.orderDate,
        paymentDueDate: o.paymentDueDate ?? null,
        currencyCode: o.currency.code,
        amountOriginal: parseFloat(o.amountOriginal.toString()), // raw order face value for col 7
        adjustmentTotal: agg.adjustmentTotal,
        netPaidAmount: agg.netPaidAmount,
        balanceOriginal: agg.balanceOriginal,
        effectiveValue: agg.effectiveValue,
        status: o.status,
        notes: o.notes ?? null,
        transactions: extractPaymentsAndRefunds(o.transactions),
      };
    });

    const buffer = await exportSalesSummary(mapped, fromDate, toDate);
    const filename = buildReportFilename("ban-hang-tong-hop", fromDate, toDate);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/sales-summary/export error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

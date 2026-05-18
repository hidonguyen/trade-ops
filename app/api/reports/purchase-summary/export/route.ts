// Purchase summary Excel export — GET /api/reports/purchase-summary/export
// Returns 12-column grouped summary workbook (.xlsx) for PURCHASE orders in a date range
import { withAuth, checkAccess, checkAccessAnyBu, buAccessFilter, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MSG } from "@/lib/messages";
import {
  exportPurchaseSummary,
  PurchaseOrderForExport,
  formatExpenseType,
} from "@/lib/excel-order-reports-service";
import { buildReportFilename } from "@/lib/excel-report-utils";
import { computeOrderAggregates, extractPaymentsAndRefunds } from "@/lib/order-aggregates";

const querySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateFrom must be YYYY-MM-DD"),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateTo must be YYYY-MM-DD"),
  businessUnitId: z.string().uuid().optional(),
});

const MAX_DAYS = 366;

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
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
  const buId = businessUnitId;
  const hasAccess = buId
    ? checkAccess(session.user.roles, "GET", "PURCHASE", buId)
    : checkAccessAnyBu(session.user.roles, "GET", "PURCHASE");
  if (!hasAccess) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }
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
    const businessUnitFilter = await buAccessFilter(session.user.roles, "PURCHASE", businessUnitId);
    const orders = await prisma.order.findMany({
      where: {
        type: "PURCHASE",
        businessUnitId: businessUnitFilter,
        OR: [
          { orderDate: { gte: fromDate, lte: toDate } },
          { transactions: { some: { transactionDate: { gte: fromDate, lte: toDate } } } },
        ],
      },
      include: {
        party: { select: { name: true } },
        currency: { select: { code: true } },
        businessUnit: { select: { code: true } },
        expenseType: { select: { name: true, isActive: true } },
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

    const mapped: PurchaseOrderForExport[] = orders.map((o) => {
      const agg = computeOrderAggregates(o.amountOriginal, o.transactions);
      return {
        businessUnitCode: o.businessUnit.code,
        partyName: o.party.name,
        orderNumber: o.orderNumber,
        orderDate: o.orderDate,
        paymentDueDate: o.paymentDueDate ?? null,
        currencyCode: o.currency.code,
        amountOriginal: parseFloat(o.amountOriginal.toString()),
        adjustmentTotal: agg.adjustmentTotal,
        netPaidAmount: agg.netPaidAmount,
        balanceOriginal: agg.balanceOriginal,
        effectiveValue: agg.effectiveValue,
        status: o.status,
        notes: o.notes ?? null,
        transactions: extractPaymentsAndRefunds(o.transactions),
        expenseTypeName: o.expenseType
          ? formatExpenseType(o.expenseType.name, o.expenseType.isActive)
          : "",
      };
    });

    const buffer = await exportPurchaseSummary(mapped, fromDate, toDate);
    const filename = buildReportFilename("mua-hang-tong-hop", fromDate, toDate);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/purchase-summary/export error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

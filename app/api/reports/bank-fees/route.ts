// Bank fee report — transactions with company-borne bank fees.
// Supports JSON + Excel export, filters by period/BU/currency/party.
import { withAuth, checkAccess, apiResponse, parsePagination, parseCsvParam } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { exportBankFeesToExcel } from "@/lib/excel-export-service";
import Decimal from "decimal.js";
import { z } from "zod";
import { MSG } from "@/lib/messages";

// currencyId and partyId excluded from Zod — parsed separately as CSV for multi-select support
const querySchema = z.object({
  businessUnitId: z.string().uuid(),
  dateFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  format: z.enum(["json", "xlsx"]).default("json"),
});

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, parsed.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  const { businessUnitId, dateFrom, dateTo, format } = parsed.data;
  // Same access gate as other reports — CASHFLOW read covers accountants + viewer
  if (!checkAccess(session.user.roles, "GET", "CASHFLOW", businessUnitId)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }
  // currencyId and partyId support multi-select CSV; single value still works
  const currencyIds = parseCsvParam(searchParams, "currencyId");
  const partyIds = parseCsvParam(searchParams, "partyId");

  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  toDate.setHours(23, 59, 59, 999);

  const { page, limit, skip } = parsePagination(searchParams);

  // Only bank payments with fee > 0
  const where = {
    paymentMethod: "BANK",
    bankFeeVnd: { gt: 0 },
    transactionDate: { gte: fromDate, lte: toDate },
    businessUnitId,
    ...(currencyIds.length > 0 && { currencyId: { in: currencyIds } }),
    ...(partyIds.length > 0 && { order: { partyId: { in: partyIds } } }),
  };

  try {
    // For Excel export, skip pagination — export all matched
    const detailQuery = {
      where,
      include: {
        currency: { select: { id: true, code: true, symbol: true } },
        businessUnit: { select: { id: true, code: true, name: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            type: true,
            party: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { transactionDate: "desc" as const },
    };

    const [rows, total, aggregates] = await Promise.all([
      format === "xlsx"
        ? prisma.transaction.findMany(detailQuery)
        : prisma.transaction.findMany({ ...detailQuery, skip, take: limit }),
      prisma.transaction.count({ where }),
      // Per-currency totals use groupBy; VND grand total sums bankFeeVnd
      prisma.transaction.groupBy({
        by: ["currencyId"],
        where,
        _sum: { bankFeeOriginal: true, bankFeeVnd: true },
      }),
    ]);

    // Resolve currency metadata for aggregates
    const aggregateCurrencyIds = aggregates.map((a) => a.currencyId);
    const currencies =
      aggregateCurrencyIds.length > 0
        ? await prisma.currency.findMany({
            where: { id: { in: aggregateCurrencyIds } },
            select: { id: true, code: true, symbol: true },
          })
        : [];
    const currencyById = new Map(currencies.map((c) => [c.id, c]));

    const byCurrency = aggregates.map((a) => {
      const cur = currencyById.get(a.currencyId);
      return {
        code: cur?.code ?? "?",
        symbol: cur?.symbol ?? "",
        totalFeeOriginal: (a._sum.bankFeeOriginal ?? new Decimal(0)).toString(),
        totalFeeVnd: (a._sum.bankFeeVnd ?? new Decimal(0)).toString(),
      };
    });

    const grandFeeVnd = aggregates
      .reduce((acc, a) => acc.plus(a._sum.bankFeeVnd ?? 0), new Decimal(0))
      .toString();

    const items = rows.map((r: any) => ({
      id: r.id,
      transactionDate: r.transactionDate,
      businessUnitCode: r.businessUnit.code,
      businessUnitId: r.businessUnitId,
      partyName: r.order?.party?.name ?? null,
      partyId: r.order?.party?.id ?? null,
      orderId: r.order?.id ?? null,
      orderNumber: r.order?.orderNumber ?? null,
      orderType: r.order?.type ?? null,
      type: r.type,
      paymentType: r.paymentType,
      amountOriginal: r.amountOriginal.toString(),
      currencyCode: r.currency.code,
      currencySymbol: r.currency.symbol,
      amountVnd: r.amountVnd.toString(),
      exchangeRate: r.exchangeRate.toString(),
      bankFeeOriginal: r.bankFeeOriginal?.toString() ?? "0",
      bankFeeVnd: r.bankFeeVnd?.toString() ?? "0",
      bankReference: r.bankReference,
      notes: r.notes,
    }));

    if (format === "xlsx") {
      const buffer = await exportBankFeesToExcel({
        rows: items.map((i) => ({
          transactionDate: i.transactionDate,
          businessUnitCode: i.businessUnitCode,
          partyName: i.partyName,
          orderNumber: i.orderNumber,
          type: i.type,
          amountOriginal: i.amountOriginal,
          currencyCode: i.currencyCode,
          bankFeeOriginal: i.bankFeeOriginal,
          bankFeeVnd: i.bankFeeVnd,
          exchangeRate: i.exchangeRate,
          bankReference: i.bankReference,
          notes: i.notes,
        })),
        totals: { grandFeeVnd, byCurrency },
      });
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="bank-fee-report.xlsx"`,
        },
      });
    }

    return Response.json({
      ...apiResponse(true, {
        items,
        totals: { grandFeeVnd, byCurrency },
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/reports/bank-fees error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

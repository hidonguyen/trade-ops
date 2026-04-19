// Summary report DOCX export — generates structured .docx grouped by business unit
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Decimal from "decimal.js";
import { MSG } from "@/lib/messages";
import { generateSummaryDocx } from "@/lib/docx-summary-export-service";

const querySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
      apiResponse(false, undefined, MSG.validationFailed),
      { status: 400 }
    );
  }

  const { dateFrom, dateTo } = parsed.data;
  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  toDate.setHours(23, 59, 59, 999);

  try {
    // Get all active business units
    const businessUnits = await prisma.businessUnit.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });

    // Build data for each BU
    const allBuData = await Promise.all(
      businessUnits.map(async (bu) => {
        // Orders with PAYMENT transactions in period
        const orders = await prisma.order.findMany({
          where: {
            businessUnitId: bu.id,
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

        // Compute debt rows
        function buildDebtRows(filteredOrders: typeof orders) {
          return filteredOrders.map((order) => {
            const orderAmt = new Decimal(order.amountOriginal.toString());
            const paidBefore = order.transactions
              .filter((t) => t.transactionDate < fromDate)
              .reduce((s, t) => s.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));
            const paidInPeriod = order.transactions
              .filter((t) => t.transactionDate >= fromDate && t.transactionDate <= toDate)
              .reduce((s, t) => s.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

            return {
              partyName: order.party.name,
              orderNumber: order.orderNumber,
              orderDate: order.orderDate.toISOString(),
              currencyCode: order.currency.code,
              currencySymbol: order.currency.symbol,
              priorDebt: Decimal.max(orderAmt.minus(paidBefore), new Decimal(0)).toFixed(4),
              periodPayment: paidInPeriod.toFixed(4),
              remainingDebt: Decimal.max(orderAmt.minus(paidBefore).minus(paidInPeriod), new Decimal(0)).toFixed(4),
              notes: order.notes,
            };
          });
        }

        // Standalone transactions in period
        const [receipts, payments] = await Promise.all([
          prisma.transaction.findMany({
            where: { businessUnitId: bu.id, orderId: null, type: "RECEIPT", transactionDate: { gte: fromDate, lte: toDate } },
            include: { currency: { select: { code: true, symbol: true } } },
            orderBy: { transactionDate: "asc" },
          }),
          prisma.transaction.findMany({
            where: { businessUnitId: bu.id, orderId: null, type: "PAYMENT", transactionDate: { gte: fromDate, lte: toDate } },
            include: { currency: { select: { code: true, symbol: true } } },
            orderBy: { transactionDate: "asc" },
          }),
        ]);

        function buildStandaloneRows(txs: typeof receipts) {
          return txs.map((t) => ({
            transactionDate: t.transactionDate.toISOString(),
            amountOriginal: t.amountOriginal.toString(),
            currencyCode: t.currency.code,
            currencySymbol: t.currency.symbol,
            paymentMethod: t.paymentMethod,
            bankReference: t.bankReference,
            notes: t.notes,
          }));
        }

        return {
          buCode: bu.code,
          buName: bu.name,
          customerReceipts: buildDebtRows(orders.filter((o) => o.type === "SALE")),
          otherReceipts: buildStandaloneRows(receipts),
          supplierPayments: buildDebtRows(orders.filter((o) => o.type === "PURCHASE")),
          otherPayments: buildStandaloneRows(payments),
        };
      })
    );

    const buffer = await generateSummaryDocx(allBuData, dateFrom, dateTo);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="bao-cao-tong-hop-${dateFrom}-${dateTo}.docx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/summary/export error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

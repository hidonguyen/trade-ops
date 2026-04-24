// Summary report Excel export — hierarchical III/IV cashflow per spec §4.1
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Decimal from "decimal.js";
import { MSG } from "@/lib/messages";
import {
  exportCashflowSummary,
  buildCashflowFilename,
  type BuSection,
  type OrderCashflowRow,
  type OtherCashflowRow,
} from "@/lib/excel-cashflow-summary-service";

const querySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Translate raw paymentMethod code to Vietnamese display label
function fmtPaymentMethod(method: string): string {
  if (method === "BANK") return "Ngân hàng";
  if (method === "DEPOSIT") return "Cọc";
  return method;
}

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
    return Response.json(apiResponse(false, undefined, MSG.validationFailed), { status: 400 });
  }

  const { dateFrom, dateTo } = parsed.data;
  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  toDate.setHours(23, 59, 59, 999);

  try {
    const businessUnits = await prisma.businessUnit.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });

    const allBuData: BuSection[] = await Promise.all(
      businessUnits.map(async (bu) => {
        // ── III.a + IV.a: Orders with PAYMENT (non-DEPOSIT) tx in period ────────
        const orders = await prisma.order.findMany({
          where: {
            businessUnitId: bu.id,
            transactions: {
              some: {
                paymentType: "PAYMENT",
                paymentMethod: { not: "DEPOSIT" },
                transactionDate: { gte: fromDate, lte: toDate },
              },
            },
          },
          include: {
            party: { select: { name: true } },
            currency: { select: { code: true } },
            // Include ALL payment tx (not just in-period) so we can compute priorDebt
            transactions: {
              where: {
                paymentType: "PAYMENT",
                paymentMethod: { not: "DEPOSIT" },
              },
              select: {
                amountOriginal: true,
                amountVnd: true,
                transactionDate: true,
              },
            },
          },
          orderBy: { orderDate: "asc" },
        });

        function buildOrderRows(filteredOrders: typeof orders): OrderCashflowRow[] {
          return filteredOrders.map((order) => {
            const orderAmt = new Decimal(order.amountOriginal.toString());

            // Paid before period start (priorDebt basis)
            const paidBefore = order.transactions
              .filter((t) => t.transactionDate < fromDate)
              .reduce((s, t) => s.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

            // Paid in period (may span multiple tx; pick latest tx date for display)
            const inPeriodTxs = order.transactions.filter(
              (t) => t.transactionDate >= fromDate && t.transactionDate <= toDate
            );
            const paidThisTime = inPeriodTxs.reduce(
              (s, t) => s.plus(new Decimal(t.amountOriginal.toString())),
              new Decimal(0)
            );
            const vndInPeriod = inPeriodTxs.reduce(
              (s, t) => s.plus(new Decimal(t.amountVnd.toString())),
              new Decimal(0)
            );

            // Use the latest in-period payment date for the "Ngày" column
            const latestTxDate = inPeriodTxs.reduce<Date | null>((latest, t) => {
              return latest === null || t.transactionDate > latest ? t.transactionDate : latest;
            }, null) ?? fromDate;

            const debtBefore = Decimal.max(orderAmt.minus(paidBefore), new Decimal(0));
            const debtRemaining = Decimal.max(
              orderAmt.minus(paidBefore).minus(paidThisTime),
              new Decimal(0)
            );

            return {
              partyName: order.party.name,
              orderNumber: order.orderNumber,
              paymentDate: latestTxDate,
              currencyCode: order.currency.code,
              debtBefore: debtBefore.toDecimalPlaces(0).toNumber(),
              paidThisTime: paidThisTime.toDecimalPlaces(0).toNumber(),
              debtRemaining: debtRemaining.toDecimalPlaces(0).toNumber(),
              vndAmount: vndInPeriod.toDecimalPlaces(0).toNumber(),
              notes: order.notes ?? null,
            };
          });
        }

        const customerReceipts = buildOrderRows(orders.filter((o) => o.type === "SALE"));
        const supplierPayments = buildOrderRows(orders.filter((o) => o.type === "PURCHASE"));

        // ── III.b: Standalone RECEIPT tx in period (exclude DEPOSIT method) ─────
        const receiptTxs = await prisma.transaction.findMany({
          where: {
            businessUnitId: bu.id,
            orderId: null,
            type: "RECEIPT",
            paymentMethod: { not: "DEPOSIT" },
            transactionDate: { gte: fromDate, lte: toDate },
          },
          include: {
            currency: { select: { code: true } },
            expenseType: { select: { name: true } },
          },
          orderBy: { transactionDate: "asc" },
        });

        // ── IV.b base: Standalone PAYMENT tx in period (exclude DEPOSIT method) ─
        const paymentTxs = await prisma.transaction.findMany({
          where: {
            businessUnitId: bu.id,
            orderId: null,
            type: "PAYMENT",
            paymentMethod: { not: "DEPOSIT" },
            transactionDate: { gte: fromDate, lte: toDate },
          },
          include: {
            currency: { select: { code: true } },
            expenseType: { select: { name: true } },
          },
          orderBy: { transactionDate: "asc" },
        });

        // ── IV.b extra: Bank-fee rows from ALL tx in period with bankFeeOriginal ─
        // Parent tx stays in its own section; only the fee amount emits here.
        const bankFeeTxs = await prisma.transaction.findMany({
          where: {
            businessUnitId: bu.id,
            transactionDate: { gte: fromDate, lte: toDate },
            bankFeeOriginal: { gt: 0 },
          },
          include: {
            currency: { select: { code: true } },
          },
          orderBy: { transactionDate: "asc" },
        });

        // ── Deposits created in period ─────────────────────────────────────────
        const deposits = await prisma.deposit.findMany({
          where: {
            businessUnitId: bu.id,
            createdAt: { gte: fromDate, lte: toDate },
          },
          include: {
            party: { select: { name: true, type: true } },
            currency: { select: { code: true } },
          },
          orderBy: { createdAt: "asc" },
        });

        // Build III.b rows
        const otherReceiptRows: OtherCashflowRow[] = receiptTxs.map((t) => ({
          transactionDate: t.transactionDate,
          payerReceiver: "",  // standalone receipt — no linked party
          description: t.expenseType?.name ?? t.notes ?? "",
          paymentMethod: fmtPaymentMethod(t.paymentMethod),
          referenceCode: t.bankReference ?? "",
          currencyCode: t.currency.code,
          originalAmount: new Decimal(t.amountOriginal.toString()).toDecimalPlaces(0).toNumber(),
          vndAmount: new Decimal(t.amountVnd.toString()).toDecimalPlaces(0).toNumber(),
          notes: t.notes ?? null,
        }));

        // Build IV.b rows from standalone payment tx
        const otherPaymentRows: OtherCashflowRow[] = paymentTxs.map((t) => ({
          transactionDate: t.transactionDate,
          payerReceiver: "",  // standalone payment — no linked party
          description: t.expenseType?.name ?? t.notes ?? "",
          paymentMethod: fmtPaymentMethod(t.paymentMethod),
          referenceCode: t.bankReference ?? "",
          currencyCode: t.currency.code,
          originalAmount: new Decimal(t.amountOriginal.toString()).toDecimalPlaces(0).toNumber(),
          vndAmount: new Decimal(t.amountVnd.toString()).toDecimalPlaces(0).toNumber(),
          notes: t.notes ?? null,
        }));

        // Append bank-fee sub-rows to IV.b — fee amount only (NOT amountOriginal)
        for (const t of bankFeeTxs) {
          if (!t.bankFeeOriginal) continue;
          otherPaymentRows.push({
            transactionDate: t.transactionDate,
            payerReceiver: "",  // bank fees have no party per validation decision
            description: `Phí ngân hàng (GD #${t.id.slice(-6)})`,
            paymentMethod: fmtPaymentMethod(t.paymentMethod),
            referenceCode: t.bankReference ?? "",
            currencyCode: t.currency.code,
            originalAmount: new Decimal(t.bankFeeOriginal.toString()).toDecimalPlaces(0).toNumber(),
            vndAmount: t.bankFeeVnd
              ? new Decimal(t.bankFeeVnd.toString()).toDecimalPlaces(0).toNumber()
              : 0,
            notes: null,
          });
        }

        // Append deposit-creation rows to III.b (customer) or IV.b (supplier)
        for (const dep of deposits) {
          const depRow: OtherCashflowRow = {
            transactionDate: dep.createdAt,
            payerReceiver: dep.party.name,
            description: "Cọc",
            paymentMethod: "Cọc",
            referenceCode: "",
            currencyCode: dep.currency.code,
            originalAmount: new Decimal(dep.amountOriginal.toString()).toDecimalPlaces(0).toNumber(),
            vndAmount: 0,  // Deposit model has no amountVnd — omit
            notes: null,
          };
          if (dep.party.type === "CUSTOMER" || dep.party.type === "BOTH") {
            otherReceiptRows.push(depRow);
          } else {
            otherPaymentRows.push(depRow);
          }
        }

        // Sort combined IV.b by date after appending bank-fee + deposit rows
        otherPaymentRows.sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());

        return {
          buCode: bu.code,
          buName: bu.name,
          customerReceipts,
          otherReceipts: otherReceiptRows,
          supplierPayments,
          otherPayments: otherPaymentRows,
        };
      })
    );

    const buffer = await exportCashflowSummary({ bus: allBuData, from: fromDate, to: toDate });
    const filename = buildCashflowFilename(fromDate, toDate);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/summary/export error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

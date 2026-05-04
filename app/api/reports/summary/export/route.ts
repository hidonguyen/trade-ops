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
            // Include ALL tx (PAYMENT/REFUND/ADJUSTMENT, non-DEPOSIT) so we can compute
            // effectiveValue + refund-aware priorDebt/remainingDebt.
            transactions: {
              where: { paymentMethod: { not: "DEPOSIT" } },
              select: {
                amountOriginal: true,
                amountVnd: true,
                bankFeeOriginal: true,
                bankFeeVnd: true,
                transactionDate: true,
                paymentType: true,
              },
            },
          },
          orderBy: { orderDate: "asc" },
        });

        function buildOrderRows(filteredOrders: typeof orders): OrderCashflowRow[] {
          return filteredOrders.map((order) => {
            const orderAmt = new Decimal(order.amountOriginal.toString());
            const txs = order.transactions;

            const sumOrig = (filter: (t: (typeof txs)[number]) => boolean) =>
              txs.filter(filter).reduce(
                (s, t) => s.plus(new Decimal(t.amountOriginal.toString())),
                new Decimal(0)
              );

            const adjTotal = sumOrig((t) => t.paymentType === "ADJUSTMENT");
            const effectiveValue = orderAmt.plus(adjTotal);

            const paymentsBefore = sumOrig(
              (t) => t.paymentType === "PAYMENT" && t.transactionDate < fromDate
            );
            const refundsBefore = sumOrig(
              (t) => t.paymentType === "REFUND" && t.transactionDate < fromDate
            );
            const paymentsAll = sumOrig((t) => t.paymentType === "PAYMENT");
            const refundsAll = sumOrig((t) => t.paymentType === "REFUND");

            const inPeriodPayments = txs.filter(
              (t) =>
                t.paymentType === "PAYMENT" &&
                t.transactionDate >= fromDate &&
                t.transactionDate <= toDate
            );
            // Gross paid this period (orig + vnd). Bank fees are NOT deducted —
            // they appear as their own row in IV.b.
            const grossPaid = inPeriodPayments.reduce(
              (s, t) => s.plus(new Decimal(t.amountOriginal.toString())),
              new Decimal(0)
            );
            const grossPaidVnd = inPeriodPayments.reduce(
              (s, t) => s.plus(new Decimal(t.amountVnd.toString())),
              new Decimal(0)
            );

            // Subtract in-period refunds — TT lần này = thực thu/chi − hoàn tiền
            const inPeriodRefunds = txs.filter(
              (t) =>
                t.paymentType === "REFUND" &&
                t.transactionDate >= fromDate &&
                t.transactionDate <= toDate
            );
            const refundedInPeriod = inPeriodRefunds.reduce(
              (s, t) => s.plus(new Decimal(t.amountOriginal.toString())),
              new Decimal(0)
            );
            const refundedVndInPeriod = inPeriodRefunds.reduce(
              (s, t) => s.plus(new Decimal(t.amountVnd.toString())),
              new Decimal(0)
            );
            const paidThisTime = grossPaid.minus(refundedInPeriod);
            const vndInPeriod = grossPaidVnd.minus(refundedVndInPeriod);

            // Use the latest in-period payment date for the "Ngày" column
            const latestTxDate = inPeriodPayments.reduce<Date | null>((latest, t) => {
              return latest === null || t.transactionDate > latest ? t.transactionDate : latest;
            }, null) ?? fromDate;

            const debtBefore = Decimal.max(
              effectiveValue.minus(paymentsBefore).plus(refundsBefore),
              new Decimal(0)
            );
            const debtRemaining = Decimal.max(
              effectiveValue.minus(paymentsAll).plus(refundsAll),
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
            order: { select: { orderNumber: true, party: { select: { name: true } } } },
          },
          orderBy: { transactionDate: "asc" },
        });

        // ── Deposits created in period (manual only — REFUND-sourced are duplicates) ─
        const deposits = await prisma.deposit.findMany({
          where: {
            businessUnitId: bu.id,
            source: "MANUAL",
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
          const partyLabel = t.order
            ? `${t.order.party.name} ${t.order.orderNumber}`
            : `GD #${t.id.slice(-6)}`;
          otherPaymentRows.push({
            transactionDate: t.transactionDate,
            payerReceiver: t.order?.party.name ?? "",
            description: `Phí ngân hàng — ${partyLabel}`,
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
          if (dep.party.type === "CUSTOMER") {
            otherReceiptRows.push(depRow);
          } else {
            otherPaymentRows.push(depRow);
          }
        }

        // Refund tx are netted into paidThisTime via buildOrderRows; not surfaced here.

        // Sort combined III.b / IV.b by date after appending deposit + bank-fee rows
        otherReceiptRows.sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
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

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

type StandaloneRow = {
  rowType: "transaction" | "deposit" | "bankFee" | "refund";
  id: string;
  date: string;
  amountOriginal: string;
  currencyCode: string;
  currencySymbol: string;
  paymentMethod: string | null;
  bankReference: string | null;
  partyName: string | null;
  contactName: string | null;
  label: string;
  notes: string | null;
  orderId: string | null;
};

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

  const { businessUnitId, dateFrom, dateTo } = parsed.data;
  if (!checkAccess(session.user.roles, "GET", "DASHBOARD", businessUnitId)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }
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
          select: {
            id: true,
            amountOriginal: true,
            bankFeeOriginal: true,
            transactionDate: true,
            paymentType: true,
            paymentMethod: true,
            bankReference: true,
          },
        },
      },
      orderBy: { orderDate: "asc" },
    });

    // Compute debt rows per order using canonical formula:
    //   effectiveValue = orderAmount + Σ(ADJUSTMENT all)
    //   priorDebt      = max(effectiveValue − Σ(PAYMENT before) + Σ(REFUND before), 0)
    //   periodPayment  = Σ(PAYMENT in period) − Σ(REFUND in period)
    //   remainingDebt  = max(effectiveValue − Σ(PAYMENT all) + Σ(REFUND all), 0)
    // Bank fees are NOT deducted here — they surface as their own row in Chi khác.
    function buildDebtRows(orders: typeof ordersWithTxs) {
      return orders.map((order) => {
        const orderAmt = new Decimal(order.amountOriginal.toString());
        const txs = order.transactions;

        const sum = (filter: (t: (typeof txs)[number]) => boolean) =>
          txs
            .filter(filter)
            .reduce((s, t) => s.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

        const adjTotal = sum((t) => t.paymentType === "ADJUSTMENT");
        const effectiveValue = orderAmt.plus(adjTotal);

        const paymentsBefore = sum((t) => t.paymentType === "PAYMENT" && t.transactionDate < fromDate);
        const refundsBefore = sum((t) => t.paymentType === "REFUND" && t.transactionDate < fromDate);
        const paymentsAll = sum((t) => t.paymentType === "PAYMENT");
        const refundsAll = sum((t) => t.paymentType === "REFUND");

        const paidInPeriod = sum(
          (t) =>
            t.paymentType === "PAYMENT" &&
            t.transactionDate >= fromDate &&
            t.transactionDate <= toDate
        );

        // Net refund into TT lần này — refund reduces actual cashflow this period.
        // Result may be negative when refund > payment in period.
        const refundedInPeriod = sum(
          (t) =>
            t.paymentType === "REFUND" &&
            t.transactionDate >= fromDate &&
            t.transactionDate <= toDate
        );
        const periodPaymentNet = paidInPeriod.minus(refundedInPeriod);

        const priorDebt = Decimal.max(
          effectiveValue.minus(paymentsBefore).plus(refundsBefore),
          new Decimal(0)
        );
        const remainingDebt = Decimal.max(
          effectiveValue.minus(paymentsAll).plus(refundsAll),
          new Decimal(0)
        );

        return {
          orderId: order.id,
          partyName: order.party.name,
          orderNumber: order.orderNumber,
          orderDate: order.orderDate.toISOString(),
          currencyCode: order.currency.code,
          currencySymbol: order.currency.symbol,
          priorDebt: priorDebt.toFixed(4),
          periodPayment: periodPaymentNet.toFixed(4),
          remainingDebt: remainingDebt.toFixed(4),
          notes: order.notes,
        };
      });
    }

    const saleOrders = ordersWithTxs.filter((o) => o.type === "SALE");
    const purchaseOrders = ordersWithTxs.filter((o) => o.type === "PURCHASE");

    // Standalone tx, manual deposits, fee-bearing tx (parallel)
    const [receipts, payments, deposits, feeTxs] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          businessUnitId,
          orderId: null,
          type: "RECEIPT",
          paymentMethod: { not: "DEPOSIT" },
          transactionDate: { gte: fromDate, lte: toDate },
        },
        include: {
          currency: { select: { code: true, symbol: true } },
          expenseType: { select: { name: true } },
          contact: { select: { name: true } },
        },
        orderBy: { transactionDate: "asc" },
      }),
      prisma.transaction.findMany({
        where: {
          businessUnitId,
          orderId: null,
          type: "PAYMENT",
          paymentMethod: { not: "DEPOSIT" },
          transactionDate: { gte: fromDate, lte: toDate },
        },
        include: {
          currency: { select: { code: true, symbol: true } },
          expenseType: { select: { name: true } },
          contact: { select: { name: true } },
        },
        orderBy: { transactionDate: "asc" },
      }),
      prisma.deposit.findMany({
        where: {
          businessUnitId,
          source: "MANUAL",
          createdAt: { gte: fromDate, lte: toDate },
        },
        include: {
          party: { select: { name: true, type: true } },
          currency: { select: { code: true, symbol: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.transaction.findMany({
        where: {
          businessUnitId,
          transactionDate: { gte: fromDate, lte: toDate },
          bankFeeOriginal: { gt: 0 },
        },
        include: {
          currency: { select: { code: true, symbol: true } },
          order: {
            select: { id: true, orderNumber: true, party: { select: { name: true } } },
          },
        },
        orderBy: { transactionDate: "asc" },
      }),
    ]);

    function buildStandaloneRows(txs: typeof receipts): StandaloneRow[] {
      return txs.map((t) => ({
        rowType: "transaction",
        id: t.id,
        date: t.transactionDate.toISOString(),
        amountOriginal: t.amountOriginal.toString(),
        currencyCode: t.currency.code,
        currencySymbol: t.currency.symbol,
        paymentMethod: t.paymentMethod,
        bankReference: t.bankReference,
        partyName: null,
        contactName: t.contact?.name ?? null,
        label: t.expenseType?.name ?? "",
        notes: t.notes,
        orderId: null,
      }));
    }

    const customerDepositRows: StandaloneRow[] = [];
    const supplierDepositRows: StandaloneRow[] = [];
    for (const d of deposits) {
      const row: StandaloneRow = {
        rowType: "deposit",
        id: d.id,
        date: d.createdAt.toISOString(),
        amountOriginal: d.amountOriginal.toString(),
        currencyCode: d.currency.code,
        currencySymbol: d.currency.symbol,
        paymentMethod: null,
        bankReference: null,
        partyName: d.party.name,
        contactName: null,
        label: d.party.type === "SUPPLIER" ? "Đặt cọc nhà cung cấp" : "Đặt cọc khách hàng",
        notes: d.notes,
        orderId: null,
      };
      if (d.party.type === "SUPPLIER") supplierDepositRows.push(row);
      else customerDepositRows.push(row);
    }

    // Bank fees: one row per source tx. Routed entirely to otherPayments (company expense).
    const feeRows: StandaloneRow[] = feeTxs
      .filter((t) => t.bankFeeOriginal)
      .map((t) => ({
        rowType: "bankFee",
        id: `${t.id}-fee`,
        date: t.transactionDate.toISOString(),
        amountOriginal: t.bankFeeOriginal!.toString(),
        currencyCode: t.currency.code,
        currencySymbol: t.currency.symbol,
        paymentMethod: t.paymentMethod,
        bankReference: t.bankReference,
        partyName: t.order?.party.name ?? null,
        contactName: null,
        label: t.order
          ? `Phí ngân hàng — ${t.order.party.name} ${t.order.orderNumber}`
          : "Phí ngân hàng",
        notes: null,
        orderId: t.order?.id ?? null,
      }));

    // Order-linked REFUND tx (non-DEPOSIT) surface as rows in Chi/Thu khác in addition
    // to being netted into periodPayment. SALE refund → otherPayments (we paid customer back),
    // PURCHASE refund → otherReceipts (supplier paid us back).
    function buildRefundRows(orders: typeof ordersWithTxs): StandaloneRow[] {
      const rows: StandaloneRow[] = [];
      for (const o of orders) {
        for (const t of o.transactions) {
          if (t.paymentType !== "REFUND") continue;
          if (t.paymentMethod === "DEPOSIT") continue;
          if (t.transactionDate < fromDate || t.transactionDate > toDate) continue;
          rows.push({
            rowType: "refund",
            id: t.id,
            date: t.transactionDate.toISOString(),
            amountOriginal: t.amountOriginal.toString(),
            currencyCode: o.currency.code,
            currencySymbol: o.currency.symbol,
            paymentMethod: t.paymentMethod,
            bankReference: t.bankReference,
            partyName: o.party.name,
            contactName: null,
            label: `Hoàn tiền — ${o.party.name} ${o.orderNumber}`,
            notes: null,
            orderId: o.id,
          });
        }
      }
      return rows;
    }
    const saleRefundRows = buildRefundRows(saleOrders);
    const purchaseRefundRows = buildRefundRows(purchaseOrders);

    const otherReceipts = [
      ...buildStandaloneRows(receipts),
      ...customerDepositRows,
      ...purchaseRefundRows,
    ].sort((a, b) => a.date.localeCompare(b.date));
    const otherPayments = [
      ...buildStandaloneRows(payments),
      ...supplierDepositRows,
      ...feeRows,
      ...saleRefundRows,
    ].sort((a, b) => a.date.localeCompare(b.date));

    return Response.json(
      apiResponse(true, {
        customerReceipts: buildDebtRows(saleOrders),
        otherReceipts,
        supplierPayments: buildDebtRows(purchaseOrders),
        otherPayments,
      })
    );
  } catch (error) {
    console.error("GET /api/reports/summary error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

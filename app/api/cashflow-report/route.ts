// Cashflow report — grouped by currency, optional Excel export
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { exportCashflowToExcel } from "@/lib/excel-export-service";
import Decimal from "decimal.js";
import { z } from "zod";
import { MSG } from "@/lib/messages";

const querySchema = z.object({
  businessUnitId: z.string().uuid(),
  dateFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  currencyId: z.string().uuid().optional(),
  format: z.enum(["json", "xlsx"]).default("json"),
});

// Transactions that count as "money in"
const MONEY_IN_TYPES = ["RECEIPT", "SALE_PAYMENT"];
// Transactions that count as "money out"
const MONEY_OUT_TYPES = ["PAYMENT", "PURCHASE_PAYMENT"];

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "GET", "CASHFLOW")) {
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

  const { businessUnitId, dateFrom, dateTo, currencyId, format } = parsed.data;
  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  // Include full last day
  toDate.setHours(23, 59, 59, 999);

  try {
    const currencyFilter = currencyId ? { currencyId } : {};

    // Fetch all transactions for the period — both standalone and order-linked
    const transactions = await prisma.transaction.findMany({
      where: {
        businessUnitId,
        transactionDate: { gte: fromDate, lte: toDate },
        ...currencyFilter,
      },
      include: {
        currency: { select: { id: true, code: true, symbol: true } },
        businessUnit: { select: { id: true, code: true, name: true } },
        order: {
          include: {
            party: { select: { name: true } },
          },
        },
      },
      orderBy: { transactionDate: "asc" },
    });

    // Group by currency and accumulate totals.
    // bankFeeOriginal is tracked per-currency (same currency as tx).
    const currencyMap = new Map<
      string,
      { code: string; symbol: string; totalIn: Decimal; totalOut: Decimal; totalFee: Decimal }
    >();
    // Total bank fee in VND — aggregated across all currencies
    let totalBankFeeVnd = new Decimal(0);

    for (const tx of transactions) {
      const { code, symbol } = tx.currency;
      if (!currencyMap.has(code)) {
        currencyMap.set(code, {
          code,
          symbol,
          totalIn: new Decimal(0),
          totalOut: new Decimal(0),
          totalFee: new Decimal(0),
        });
      }
      const entry = currencyMap.get(code)!;
      const amount = new Decimal(tx.amountOriginal.toString());
      const feeOriginal = tx.bankFeeOriginal ? new Decimal(tx.bankFeeOriginal.toString()) : new Decimal(0);
      const feeVnd = tx.bankFeeVnd ? new Decimal(tx.bankFeeVnd.toString()) : new Decimal(0);
      entry.totalFee = entry.totalFee.plus(feeOriginal);
      totalBankFeeVnd = totalBankFeeVnd.plus(feeVnd);

      if (tx.paymentType === "PAYMENT") {
        if (MONEY_IN_TYPES.includes(tx.type)) {
          entry.totalIn = entry.totalIn.plus(amount);
        } else if (MONEY_OUT_TYPES.includes(tx.type)) {
          entry.totalOut = entry.totalOut.plus(amount);
        }
      } else if (tx.paymentType === "REFUND") {
        // Refunds reverse the direction
        if (MONEY_IN_TYPES.includes(tx.type)) {
          entry.totalOut = entry.totalOut.plus(amount);
        } else if (MONEY_OUT_TYPES.includes(tx.type)) {
          entry.totalIn = entry.totalIn.plus(amount);
        }
      }
    }

    const currencies = Array.from(currencyMap.values()).map((c) => ({
      code: c.code,
      symbol: c.symbol,
      totalIn: c.totalIn.toFixed(4),
      totalOut: c.totalOut.toFixed(4),
      net: c.totalIn.minus(c.totalOut).toFixed(4),
      totalBankFee: c.totalFee.toFixed(4),
      // Net cash received after bank fee: only meaningful for money-in flows
      netAfterFee: c.totalIn.minus(c.totalFee).minus(c.totalOut).toFixed(4),
    }));

    const txRows = transactions.map((tx: any) => {
      const feeOriginal = tx.bankFeeOriginal ? tx.bankFeeOriginal.toString() : null;
      const feeVnd = tx.bankFeeVnd ? tx.bankFeeVnd.toString() : null;
      return {
        id: tx.id,
        transactionDate: tx.transactionDate,
        type: tx.type,
        paymentType: tx.paymentType,
        paymentMethod: tx.paymentMethod,
        amountOriginal: tx.amountOriginal.toString(),
        currencyCode: tx.currency.code,
        bankReference: tx.bankReference,
        partyName: tx.order?.party?.name ?? null,
        notes: tx.notes,
        bankFeeOriginal: feeOriginal,
        bankFeeVnd: feeVnd,
      };
    });

    if (format === "xlsx") {
      const buffer = await exportCashflowToExcel({ currencies, transactions: txRows });
      // Buffer.from ensures BodyInit-compatible Uint8Array for Response
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="cashflow-report.xlsx"`,
        },
      });
    }

    return Response.json(apiResponse(true, { currencies, transactions: txRows }));
  } catch (error) {
    console.error("GET /api/cashflow-report error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

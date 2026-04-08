// Cashflow report — grouped by currency, optional Excel export
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { exportCashflowToExcel } from "@/lib/excel-export-service";
import Decimal from "decimal.js";
import { z } from "zod";

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
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "GET", "CASHFLOW")) {
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
        currency: { select: { code: true, symbol: true } },
        order: {
          include: {
            party: { select: { name: true } },
          },
        },
      },
      orderBy: { transactionDate: "asc" },
    });

    // Group by currency and accumulate totals
    const currencyMap = new Map<
      string,
      { code: string; symbol: string; totalIn: Decimal; totalOut: Decimal }
    >();

    for (const tx of transactions) {
      const { code, symbol } = tx.currency;
      if (!currencyMap.has(code)) {
        currencyMap.set(code, { code, symbol, totalIn: new Decimal(0), totalOut: new Decimal(0) });
      }
      const entry = currencyMap.get(code)!;
      const amount = new Decimal(tx.amountOriginal.toString());

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
    }));

    const txRows = transactions.map((tx: any) => ({
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
    }));

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
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

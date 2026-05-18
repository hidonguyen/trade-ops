// Cashflow report — unified rows (Transaction + manual Deposit creations),
// grouped by currency, optional Excel export
import { withAuth, checkAccess, apiResponse, parseCsvParam } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { exportCashflowToExcel } from "@/lib/excel-export-service";
import Decimal from "decimal.js";
import { z } from "zod";
import { MSG } from "@/lib/messages";

// currencyId excluded from Zod — parsed separately as CSV to support multi-select
const querySchema = z.object({
  businessUnitId: z.string().uuid(),
  dateFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(25),
  format: z.enum(["json", "xlsx"]).default("json"),
});

// Resolve human-readable category from (type, paymentType). Only PAYMENT and
// REFUND are kept (ADJUSTMENT filtered upstream). Direction encoded by isMoneyIn.
function resolveTxCategory(type: string, paymentType: string): { label: string; isMoneyIn: boolean } {
  // SALE side
  if (type === "SALE_PAYMENT" && paymentType === "PAYMENT") return { label: "Thu bán hàng", isMoneyIn: true };
  if (type === "SALE_PAYMENT" && paymentType === "REFUND") return { label: "Chi hoàn tiền", isMoneyIn: false };
  // PURCHASE side
  if (type === "PURCHASE_PAYMENT" && paymentType === "PAYMENT") return { label: "Chi mua hàng", isMoneyIn: false };
  if (type === "PURCHASE_PAYMENT" && paymentType === "REFUND") return { label: "Thu hoàn tiền", isMoneyIn: true };
  // Standalone (no order)
  if (type === "RECEIPT") {
    return paymentType === "REFUND"
      ? { label: "Chi hoàn tiền", isMoneyIn: false }
      : { label: "Thu khác", isMoneyIn: true };
  }
  if (type === "PAYMENT") {
    return paymentType === "REFUND"
      ? { label: "Thu hoàn tiền", isMoneyIn: true }
      : { label: "Chi khác", isMoneyIn: false };
  }
  return { label: type, isMoneyIn: false };
}

interface CashflowRow {
  id: string;
  rowKind: "transaction" | "deposit";
  category: string;
  isMoneyIn: boolean;
  transactionDate: Date;
  type: string;             // raw, retained for reference
  paymentType: string;      // PAYMENT | REFUND | DEPOSIT_CREATE
  paymentMethod: string;    // BANK | DEPOSIT (always BANK or "—" here)
  amountOriginal: string;
  amountVnd: string;
  currencyCode: string;
  currency: { id: string; code: string; symbol: string };
  businessUnit: { id: string; code: string; name: string };
  bankReference: string | null;
  partyName: string | null;
  orderId: string | null;
  orderNumber: string | null;
  expenseTypeName: string | null;
  notes: string | null;
  description: string | null; // combined "Diễn giải": order.notes / tx.notes / expenseType
  createdBy: string;
  bankFeeOriginal: string | null;
  bankFeeVnd: string | null;
}

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

  const { businessUnitId, dateFrom, dateTo, page, limit, format } = parsed.data;
  if (!checkAccess(session.user.roles, "GET", "CASHFLOW", businessUnitId)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }
  // currencyId supports multi-select CSV (e.g. "id1,id2"); single value still works
  const currencyIds = parseCsvParam(searchParams, "currencyId");
  const currencyFilter = currencyIds.length > 0 ? { currencyId: { in: currencyIds } } : {};

  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  toDate.setHours(23, 59, 59, 999);

  try {
    // Fetch tx (exclude ADJUSTMENT and DEPOSIT-method — neither is real cashflow).
    // Then fetch manual Deposit creations as pseudo-rows ("Thu/Chi đặt cọc").
    const [transactions, deposits] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          businessUnitId,
          transactionDate: { gte: fromDate, lte: toDate },
          paymentType: { in: ["PAYMENT", "REFUND"] },
          paymentMethod: { not: "DEPOSIT" },
          ...currencyFilter,
        },
        include: {
          currency: { select: { id: true, code: true, symbol: true } },
          businessUnit: { select: { id: true, code: true, name: true } },
          order: { select: { id: true, orderNumber: true, notes: true, party: { select: { name: true } } } },
          expenseType: { select: { name: true } },
        },
        orderBy: { transactionDate: "asc" },
      }),
      prisma.deposit.findMany({
        where: {
          businessUnitId,
          source: "MANUAL",
          createdAt: { gte: fromDate, lte: toDate },
          ...currencyFilter,
        },
        include: {
          currency: { select: { id: true, code: true, symbol: true } },
          businessUnit: { select: { id: true, code: true, name: true } },
          party: { select: { name: true, type: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // ── Build unified row list ────────────────────────────────────────────────
    const txRows: CashflowRow[] = transactions.map((tx) => {
      const cat = resolveTxCategory(tx.type, tx.paymentType);
      // Diễn giải: prefer order's notes, then tx's own notes, then expense category name.
      const description =
        tx.order?.notes?.trim() || tx.notes?.trim() || tx.expenseType?.name || null;
      return {
        id: tx.id,
        rowKind: "transaction",
        category: cat.label,
        isMoneyIn: cat.isMoneyIn,
        transactionDate: tx.transactionDate,
        type: tx.type,
        paymentType: tx.paymentType,
        paymentMethod: tx.paymentMethod,
        amountOriginal: tx.amountOriginal.toString(),
        amountVnd: tx.amountVnd.toString(),
        currencyCode: tx.currency.code,
        currency: tx.currency,
        businessUnit: tx.businessUnit,
        bankReference: tx.bankReference,
        partyName: tx.order?.party?.name ?? null,
        orderId: tx.order?.id ?? null,
        orderNumber: tx.order?.orderNumber ?? null,
        expenseTypeName: tx.expenseType?.name ?? null,
        notes: tx.notes,
        description,
        createdBy: tx.createdBy,
        bankFeeOriginal: tx.bankFeeOriginal ? tx.bankFeeOriginal.toString() : null,
        bankFeeVnd: tx.bankFeeVnd ? tx.bankFeeVnd.toString() : null,
      };
    });

    const depositRows: CashflowRow[] = deposits.map((d) => {
      const isCustomer = d.party.type === "CUSTOMER";
      return {
        id: `deposit-${d.id}`,
        rowKind: "deposit",
        category: isCustomer ? "Thu đặt cọc khách hàng" : "Chi đặt cọc nhà cung cấp",
        isMoneyIn: isCustomer,
        transactionDate: d.createdAt,
        type: isCustomer ? "DEPOSIT_IN" : "DEPOSIT_OUT",
        paymentType: "DEPOSIT_CREATE",
        paymentMethod: "BANK",
        amountOriginal: d.amountOriginal.toString(),
        amountVnd: "0", // Deposit model has no VND amount
        currencyCode: d.currency.code,
        currency: d.currency,
        businessUnit: d.businessUnit,
        bankReference: null,
        partyName: d.party.name,
        orderId: null,
        orderNumber: null,
        expenseTypeName: null,
        notes: d.notes,
        description: d.notes?.trim() || null,
        createdBy: "—", // Deposit model has no createdBy
        bankFeeOriginal: null,
        bankFeeVnd: null,
      };
    });

    const allRows = [...txRows, ...depositRows].sort(
      (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime()
    );

    // ── Summary per currency (full set, not paginated) ────────────────────────
    const currencyMap = new Map<
      string,
      { code: string; symbol: string; totalIn: Decimal; totalOut: Decimal; totalFee: Decimal }
    >();
    for (const r of allRows) {
      if (!currencyMap.has(r.currencyCode)) {
        currencyMap.set(r.currencyCode, {
          code: r.currencyCode,
          symbol: r.currency.symbol,
          totalIn: new Decimal(0),
          totalOut: new Decimal(0),
          totalFee: new Decimal(0),
        });
      }
      const entry = currencyMap.get(r.currencyCode)!;
      const amount = new Decimal(r.amountOriginal);
      if (r.isMoneyIn) entry.totalIn = entry.totalIn.plus(amount);
      else entry.totalOut = entry.totalOut.plus(amount);
      if (r.bankFeeOriginal) {
        entry.totalFee = entry.totalFee.plus(new Decimal(r.bankFeeOriginal));
      }
    }

    const currencies = Array.from(currencyMap.values()).map((c) => ({
      code: c.code,
      symbol: c.symbol,
      totalIn: c.totalIn.toFixed(4),
      totalOut: c.totalOut.toFixed(4),
      net: c.totalIn.minus(c.totalOut).toFixed(4),
      totalBankFee: c.totalFee.toFixed(4),
      netAfterFee: c.totalIn.minus(c.totalFee).minus(c.totalOut).toFixed(4),
    }));

    // ── Pagination (server-side) ──────────────────────────────────────────────
    const total = allRows.length;
    const startIdx = (page - 1) * limit;
    const pagedRows = format === "xlsx" ? allRows : allRows.slice(startIdx, startIdx + limit);

    if (format === "xlsx") {
      const buffer = await exportCashflowToExcel({ currencies, transactions: pagedRows });
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="cashflow-report.xlsx"`,
        },
      });
    }

    return Response.json({
      ...apiResponse(true, { currencies, transactions: pagedRows }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/cashflow-report error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

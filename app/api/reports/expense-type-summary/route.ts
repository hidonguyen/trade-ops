// Expense-type summary report — PURCHASE orders grouped by ExpenseType + currency.
// Orders with no expense type land in the "Chưa phân loại" bucket (expenseTypeId=null).
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";
import { z } from "zod";
import { MSG } from "@/lib/messages";

const querySchema = z.object({
  businessUnitId: z.string().uuid(),
  dateFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

type CurrencyTotal = { code: string; symbol: string; total: string };

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
      apiResponse(false, undefined, MSG.validationFailed, parsed.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  const { businessUnitId, dateFrom, dateTo } = parsed.data;
  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  toDate.setHours(23, 59, 59, 999);

  try {
    const orders = await prisma.order.findMany({
      where: {
        businessUnitId,
        type: "PURCHASE",
        orderDate: { gte: fromDate, lte: toDate },
      },
      select: {
        amountOriginal: true,
        expenseTypeId: true,
        expenseType: { select: { id: true, name: true } },
        currency: { select: { code: true, symbol: true } },
      },
    });

    // Group: expenseTypeId (or null) → name → { count, byCurrency }
    const bucketKey = (id: string | null) => id ?? "__UNCATEGORIZED__";
    const buckets = new Map<
      string,
      {
        expenseTypeId: string | null;
        name: string;
        count: number;
        byCurrency: Map<string, { code: string; symbol: string; total: Decimal }>;
      }
    >();

    for (const o of orders) {
      const key = bucketKey(o.expenseTypeId);
      if (!buckets.has(key)) {
        buckets.set(key, {
          expenseTypeId: o.expenseTypeId,
          name: o.expenseType?.name ?? "Chưa phân loại",
          count: 0,
          byCurrency: new Map(),
        });
      }
      const bucket = buckets.get(key)!;
      bucket.count += 1;

      const curKey = o.currency.code;
      if (!bucket.byCurrency.has(curKey)) {
        bucket.byCurrency.set(curKey, {
          code: o.currency.code,
          symbol: o.currency.symbol,
          total: new Decimal(0),
        });
      }
      const cur = bucket.byCurrency.get(curKey)!;
      cur.total = cur.total.plus(new Decimal(o.amountOriginal.toString()));
    }

    const byExpenseType = Array.from(buckets.values())
      .map((b) => ({
        expenseTypeId: b.expenseTypeId,
        name: b.name,
        count: b.count,
        totals: Array.from(b.byCurrency.values()).map<CurrencyTotal>((c) => ({
          code: c.code,
          symbol: c.symbol,
          total: c.total.toFixed(4),
        })),
      }))
      // Deterministic ordering: real expense types first (by name), then uncategorized last
      .sort((a, b) => {
        if (a.expenseTypeId === null) return 1;
        if (b.expenseTypeId === null) return -1;
        return a.name.localeCompare(b.name, "vi");
      });

    return Response.json(apiResponse(true, { byExpenseType }));
  } catch (error) {
    console.error("GET /api/reports/expense-type-summary error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

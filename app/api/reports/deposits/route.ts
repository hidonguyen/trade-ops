// Deposit tracking report — flattened timeline of deposit creation and usage events
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { MSG } from "@/lib/messages";
import Decimal from "decimal.js";

interface DepositEvent {
  id: string;
  date: string;
  eventType: "DEPOSIT_CREATED" | "DEPOSIT_USED" | "DEPOSIT_REFUNDED";
  amountOriginal: string;
  depositId: string;
  remainingOriginal: string;
  party: { id: string; name: string };
  currency: { code: string; symbol: string };
  businessUnit: { code: string };
  reference: string | null;
}

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  // Require access to at least one party-related module
  const canCustomer = checkAccess(session.user.roles, "GET", "CUSTOMER");
  const canSupplier = checkAccess(session.user.roles, "GET", "SUPPLIER");
  if (!canCustomer && !canSupplier) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const businessUnitId = searchParams.get("businessUnitId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const partyId = searchParams.get("partyId");
  const currencyId = searchParams.get("currencyId");

  try {
    // Build deposit filter
    const depositWhere: Record<string, unknown> = {};
    if (businessUnitId) depositWhere.businessUnitId = businessUnitId;
    if (partyId) depositWhere.partyId = partyId;
    if (currencyId) depositWhere.currencyId = currencyId;

    const deposits = await prisma.deposit.findMany({
      where: depositWhere,
      include: {
        party: { select: { id: true, name: true } },
        currency: { select: { code: true, symbol: true } },
        businessUnit: { select: { code: true } },
        usages: {
          include: {
            transaction: { select: { bankReference: true, notes: true, paymentType: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Build date filter boundaries
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? (() => { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); return d; })() : null;

    function inDateRange(d: Date): boolean {
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    }

    // Flatten deposits + usages into event timeline
    const events: DepositEvent[] = [];

    for (const dep of deposits) {
      const base = {
        depositId: dep.id,
        remainingOriginal: dep.remainingOriginal.toString(),
        party: dep.party,
        currency: dep.currency,
        businessUnit: dep.businessUnit,
      };

      // Deposit creation event
      if (inDateRange(dep.createdAt)) {
        events.push({
          ...base,
          id: `dep-${dep.id}`,
          date: dep.createdAt.toISOString(),
          eventType: "DEPOSIT_CREATED",
          amountOriginal: dep.amountOriginal.toString(),
          reference: null,
        });
      }

      // Usage events
      for (const usage of dep.usages) {
        if (!inDateRange(usage.createdAt)) continue;

        const amt = new Decimal(usage.amountOriginal.toString());
        const isDeduction = amt.isPositive();

        events.push({
          ...base,
          id: usage.id,
          date: usage.createdAt.toISOString(),
          eventType: isDeduction ? "DEPOSIT_USED" : "DEPOSIT_REFUNDED",
          amountOriginal: amt.abs().toString(),
          reference: usage.transaction?.bankReference ?? usage.transaction?.notes ?? null,
        });
      }
    }

    // Sort by date desc
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return Response.json(apiResponse(true, events));
  } catch (error) {
    console.error("GET /api/reports/deposits error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

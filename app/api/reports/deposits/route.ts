// Deposit tracking report — master-detail: each Deposit is a master row with
// nested DepositUsage events (deductions/refunds). REFUND-source deposits hide
// their seed usage (the auto-generated bookkeeping row at deposit creation).
import { withAuth, checkAccess, apiResponse, parseCsvParam } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { MSG } from "@/lib/messages";
import Decimal from "decimal.js";
import { exportDepositTracking, buildDepositTrackingFilename } from "@/lib/excel-deposit-tracking-service";

interface DepositUsageDto {
  id: string;
  createdAt: string;
  amountOriginal: string;
  eventType: "DEPOSIT_USED" | "DEPOSIT_REFUNDED";
  reference: string | null;
  orderId: string | null;
}

interface DepositMasterDto {
  id: string;
  createdAt: string;
  source: string;
  partyId: string;
  partyName: string;
  partyType: string;
  buCode: string;
  currencyCode: string;
  currencySymbol: string;
  amountOriginal: string;
  remainingOriginal: string;
  notes: string | null;
  usages: DepositUsageDto[];
}

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const canCustomer = checkAccess(session.user.roles, "GET", "CUSTOMER");
  const canSupplier = checkAccess(session.user.roles, "GET", "SUPPLIER");
  if (!canCustomer && !canSupplier) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const businessUnitId = searchParams.get("businessUnitId");
  if (!businessUnitId) {
    return Response.json(apiResponse(false, undefined, MSG.businessUnitRequired), { status: 400 });
  }
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  // partyId and currencyId support multi-select CSV; single value still works
  const partyIds = parseCsvParam(searchParams, "partyId");
  const currencyIds = parseCsvParam(searchParams, "currencyId");
  // Default true: depleted deposits (remaining=0) usually finished and noisy
  const hideDepleted = searchParams.get("hideDepleted") !== "false";
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "json";

  try {
    const depositWhere: Record<string, unknown> = { businessUnitId };
    if (partyIds.length > 0) depositWhere.partyId = { in: partyIds };
    if (currencyIds.length > 0) depositWhere.currencyId = { in: currencyIds };

    const deposits = await prisma.deposit.findMany({
      where: depositWhere,
      include: {
        party: { select: { id: true, name: true, type: true } },
        currency: { select: { code: true, symbol: true } },
        businessUnit: { select: { code: true } },
        usages: {
          include: {
            transaction: { select: { bankReference: true, notes: true, paymentType: true, orderId: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo
      ? (() => { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); return d; })()
      : null;

    function inRange(d: Date): boolean {
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    }

    const masters: DepositMasterDto[] = [];

    for (const dep of deposits) {
      if (hideDepleted && new Decimal(dep.remainingOriginal.toString()).isZero()) continue;

      // Hide REFUND-seed usage: auto-generated bookkeeping row inside the same
      // $transaction as deposit creation. Heuristic: first usage created within
      // 5s of deposit, with linked tx of paymentType=REFUND, and amount equal
      // to negated deposit total.
      let visibleUsages = dep.usages;
      if (dep.source === "REFUND" && dep.usages.length > 0) {
        const first = dep.usages[0];
        const dt = Math.abs(first.createdAt.getTime() - dep.createdAt.getTime());
        const seedAmt = new Decimal(first.amountOriginal.toString());
        const negDep = new Decimal(dep.amountOriginal.toString()).negated();
        const isSeed =
          dt < 5000 &&
          first.transaction?.paymentType === "REFUND" &&
          seedAmt.equals(negDep);
        if (isSeed) visibleUsages = dep.usages.slice(1);
      }

      // Date filter: master OR any visible usage in-range. When master out-of-range,
      // show only in-range usages. When master in-range, show all visible usages.
      const masterIn = inRange(dep.createdAt);
      const usagesInRange = visibleUsages.filter((u) => inRange(u.createdAt));
      if (!masterIn && usagesInRange.length === 0) continue;
      const finalUsages = masterIn ? visibleUsages : usagesInRange;

      const usageDtos: DepositUsageDto[] = finalUsages.map((u) => {
        const amt = new Decimal(u.amountOriginal.toString());
        return {
          id: u.id,
          createdAt: u.createdAt.toISOString(),
          amountOriginal: amt.abs().toFixed(4),
          eventType: amt.isPositive() ? "DEPOSIT_USED" : "DEPOSIT_REFUNDED",
          reference: u.transaction?.bankReference ?? u.transaction?.notes ?? null,
          orderId: u.transaction?.orderId ?? null,
        };
      });

      masters.push({
        id: dep.id,
        createdAt: dep.createdAt.toISOString(),
        source: dep.source,
        partyId: dep.party.id,
        partyName: dep.party.name,
        partyType: dep.party.type,
        buCode: dep.businessUnit.code,
        currencyCode: dep.currency.code,
        currencySymbol: dep.currency.symbol,
        amountOriginal: dep.amountOriginal.toString(),
        remainingOriginal: dep.remainingOriginal.toString(),
        notes: dep.notes,
        usages: usageDtos,
      });
    }

    if (format === "xlsx") {
      const buf = await exportDepositTracking(
        masters.map((m) => ({
          createdAt: m.createdAt,
          source: m.source,
          partyName: m.partyName,
          partyType: m.partyType,
          buCode: m.buCode,
          currencyCode: m.currencyCode,
          amountOriginal: Number(m.amountOriginal),
          remainingOriginal: Number(m.remainingOriginal),
          notes: m.notes,
          usages: m.usages.map((u) => ({
            createdAt: u.createdAt,
            eventType: u.eventType,
            amountOriginal: Number(u.amountOriginal),
            reference: u.reference,
          })),
        }))
      );
      const filename = buildDepositTrackingFilename(fromDate, toDate);
      return new Response(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return Response.json(apiResponse(true, { deposits: masters }));
  } catch (error) {
    console.error("GET /api/reports/deposits error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

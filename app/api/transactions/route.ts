// Standalone transactions (RECEIPT/PAYMENT not tied to an order): GET list, POST create
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse, parsePagination, parseCsvParam } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createStandaloneTransactionSchema } from "@/lib/validation-schemas";
import { applyDepositOperation } from "@/lib/deposit-deduction-service";
import { MSG } from "@/lib/messages";
import { invalidateTags } from "@/lib/cache/invalidate";
import { TAG } from "@/lib/cache/keys";

const txIncludes = {
  currency: { select: { id: true, code: true, symbol: true } },
  businessUnit: { select: { id: true, code: true, name: true } },
  expenseType: { select: { id: true, name: true, isActive: true } },
  contact: { select: { id: true, name: true, phone: true } },
  depositUsages: true,
};

export async function GET(request: NextRequest) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  // type filter: CSV of RECEIPT/PAYMENT — used to restrict within allowed types
  const typeFilter = parseCsvParam(searchParams, "type");

  // Resolve BU first — needed for per-BU RBAC checks below
  const businessUnitId = searchParams.get("businessUnitId");
  // Enforce BU scope to prevent cross-BU data leakage
  if (!businessUnitId) {
    return Response.json(apiResponse(false, undefined, MSG.businessUnitRequired), { status: 400 });
  }

  const canReceipt = checkAccess(session.user.roles, "GET", "RECEIPT", businessUnitId);
  const canPayment = checkAccess(session.user.roles, "GET", "PAYMENT", businessUnitId);
  if (!canReceipt && !canPayment) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  // Intersect requested types with permitted types
  const permittedTypes: string[] = [];
  if (canReceipt) permittedTypes.push("RECEIPT");
  if (canPayment) permittedTypes.push("PAYMENT");
  const allowedTypes =
    typeFilter.length > 0
      ? permittedTypes.filter((t) => typeFilter.includes(t))
      : permittedTypes;
  if (allowedTypes.length === 0) {
    return Response.json(apiResponse(false, undefined, MSG.accessDeniedForType), { status: 403 });
  }
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const bankReference = searchParams.get("bankReference");
  const expenseTypeIds = parseCsvParam(searchParams, "expenseTypeId");
  const contactIds = parseCsvParam(searchParams, "contactId");
  const paymentMethods = parseCsvParam(searchParams, "paymentMethod");
  const { page, limit, skip, sortBy, order } = parsePagination(searchParams);

  // Build date range filter — include full last day
  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const where = {
    orderId: null,
    type: { in: allowedTypes },
    businessUnitId,
    ...(Object.keys(dateFilter).length > 0 && { transactionDate: dateFilter }),
    ...(bankReference && { bankReference: { contains: bankReference, mode: "insensitive" as const } }),
    ...(expenseTypeIds.length > 0 && { expenseTypeId: { in: expenseTypeIds } }),
    ...(contactIds.length > 0 && { contactId: { in: contactIds } }),
    // paymentMethod is a free-form String column (BANK/DEPOSIT/CASH) — no enum cast needed
    ...(paymentMethods.length > 0 && { paymentMethod: { in: paymentMethods } }),
  };

  try {
    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: txIncludes,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);
    return Response.json({
      ...apiResponse(true, data),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/transactions error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const body = await request.json();
  const validation = createStandaloneTransactionSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  const userId = session.user.id!;
  const { type } = validation.data;
  const module = type === "RECEIPT" ? "RECEIPT" : "PAYMENT";
  if (!checkAccess(session.user.roles, "CREATE", module, validation.data.businessUnitId)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  // partyId is validation-only metadata used for auto-create; never stored on Transaction
  const { depositId, partyId, ...txData } = validation.data;

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const created = await tx.transaction.create({
        data: { ...txData, orderId: null, createdBy: userId },
        include: txIncludes,
      });

      // Deposit flow: deduct for PAYMENT, credit (or auto-create) for REFUND
      if (txData.paymentMethod === "DEPOSIT") {
        await applyDepositOperation(tx, {
          paymentType: txData.paymentType,
          depositId: depositId ?? null,
          amountOriginal: txData.amountOriginal,
          transactionId: created.id,
          currencyId: txData.currencyId,
          partyContext: partyId
            ? {
                partyId,
                businessUnitId: txData.businessUnitId,
                currencyId: txData.currencyId,
              }
            : undefined,
          notes: txData.notes ?? null,
        });
      }

      await createAuditLog(
        tx,
        userId,
        "CREATE",
        "Transaction",
        created.id,
        validation.data as Record<string, unknown>,
      );

      return created;
    });

    const txInvalidations = [TAG.reportsByBu(result.businessUnitId)];
    // Deposit-funded or deposit-topup transactions affect a party's deposit balances.
    if (txData.paymentMethod === "DEPOSIT" && partyId) {
      txInvalidations.push(TAG.partyDeposits(partyId), TAG.party(partyId));
    }
    invalidateTags(txInvalidations);
    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === MSG.insufficientDeposit || error.message === MSG.depositCurrencyMismatch)) {
      return Response.json(apiResponse(false, undefined, error.message), { status: 422 });
    }
    console.error("POST /api/transactions error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

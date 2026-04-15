// Standalone transactions (RECEIPT/PAYMENT not tied to an order): GET list, POST create
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse, parsePagination } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createStandaloneTransactionSchema } from "@/lib/validation-schemas";
import { applyDepositOperation } from "@/lib/deposit-deduction-service";
import { MSG } from "@/lib/messages";

const txIncludes = {
  currency: { select: { id: true, code: true, symbol: true } },
  businessUnit: { select: { id: true, code: true, name: true } },
  depositUsages: true,
};

export async function GET(request: NextRequest) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type"); // RECEIPT | PAYMENT

  const canReceipt = checkAccess(session.user.roles, "GET", "RECEIPT");
  const canPayment = checkAccess(session.user.roles, "GET", "PAYMENT");
  if (!canReceipt && !canPayment) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const allowedTypes: string[] = [];
  if (!type || type === "RECEIPT") { if (canReceipt) allowedTypes.push("RECEIPT"); }
  if (!type || type === "PAYMENT") { if (canPayment) allowedTypes.push("PAYMENT"); }
  if (allowedTypes.length === 0) {
    return Response.json(apiResponse(false, undefined, MSG.accessDeniedForType), { status: 403 });
  }

  const businessUnitId = searchParams.get("businessUnitId");
  const { page, limit, skip, sortBy, order } = parsePagination(searchParams);

  const where = {
    orderId: null,
    type: { in: allowedTypes },
    ...(businessUnitId && { businessUnitId }),
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
  if (!checkAccess(session.user.roles, "CREATE", module)) {
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
          partyContext: partyId
            ? {
                partyId,
                businessUnitId: txData.businessUnitId,
                currencyId: txData.currencyId,
              }
            : undefined,
        });
      }

      await createAuditLog(tx, userId, "CREATE", "Transaction", created.id, {
        type,
        amountOriginal: txData.amountOriginal,
        depositId,
        partyId,
      });

      return created;
    });

    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === MSG.insufficientDeposit) {
      return Response.json(apiResponse(false, undefined, error.message), { status: 422 });
    }
    console.error("POST /api/transactions error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

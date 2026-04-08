// Standalone transactions (RECEIPT/PAYMENT not tied to an order): GET list, POST create
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse, parsePagination } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createStandaloneTransactionSchema } from "@/lib/validation-schemas";
import { deductDeposit } from "@/lib/deposit-deduction-service";

const txIncludes = {
  currency: { select: { id: true, code: true, symbol: true } },
  businessUnit: { select: { id: true, code: true, name: true } },
  depositUsages: true,
};

export async function GET(request: NextRequest) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type"); // RECEIPT | PAYMENT

  const canReceipt = checkAccess(session.user.roles, "GET", "RECEIPT");
  const canPayment = checkAccess(session.user.roles, "GET", "PAYMENT");
  if (!canReceipt && !canPayment) {
    return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
  }

  const allowedTypes: string[] = [];
  if (!type || type === "RECEIPT") { if (canReceipt) allowedTypes.push("RECEIPT"); }
  if (!type || type === "PAYMENT") { if (canPayment) allowedTypes.push("PAYMENT"); }
  if (allowedTypes.length === 0) {
    return Response.json(apiResponse(false, undefined, "Access denied for requested type"), { status: 403 });
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
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const body = await request.json();
  const validation = createStandaloneTransactionSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, "Validation failed", validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  const userId = session.user.id!;
  const { type } = validation.data;
  const module = type === "RECEIPT" ? "RECEIPT" : "PAYMENT";
  if (!checkAccess(session.user.roles, "CREATE", module)) {
    return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
  }

  const { depositId, ...txData } = validation.data;

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const created = await tx.transaction.create({
        data: { ...txData, orderId: null, createdBy: userId },
        include: txIncludes,
      });

      if (depositId) {
        await deductDeposit(tx, depositId, txData.amountOriginal, created.id);
      }

      await createAuditLog(tx, userId, "CREATE", "Transaction", created.id, {
        type,
        amountOriginal: txData.amountOriginal,
        depositId,
      });

      return created;
    });

    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient deposit balance") {
      return Response.json(apiResponse(false, undefined, error.message), { status: 422 });
    }
    console.error("POST /api/transactions error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

// Order transactions: GET list, POST create (with optional deposit deduction + status recalc)
// All multi-step ops are atomic via prisma.$transaction
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse, parsePagination } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createOrderTransactionSchema } from "@/lib/validation-schemas";
import { deductDeposit } from "@/lib/deposit-deduction-service";
import { recalculateOrderStatus } from "@/lib/order-status-calculator";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const { id: orderId } = await params;

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { type: true } });
    if (!order) {
      return Response.json(apiResponse(false, undefined, "Order not found"), { status: 404 });
    }

    const module = order.type === "SALE" ? "SALE" : "PURCHASE";
    if (!checkAccess(session.user.roles, "GET", module)) {
      return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const { page, limit, skip, order: sortOrder } = parsePagination(searchParams);

    const where = { orderId };
    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { currency: { select: { id: true, code: true, symbol: true } }, depositUsages: true },
        orderBy: { transactionDate: sortOrder },
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
    console.error("GET /api/orders/[id]/transactions error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const { id: orderId } = await params;
  const body = await request.json();

  const validation = createOrderTransactionSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, "Validation failed", validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, type: true, businessUnitId: true },
    });
    if (!order) {
      return Response.json(apiResponse(false, undefined, "Order not found"), { status: 404 });
    }

    const module = order.type === "SALE" ? "SALE" : "PURCHASE";
    if (!checkAccess(session.user.roles, "CREATE", module)) {
      return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
    }

    const userId = session.user.id!;
    const { depositId, ...txData } = validation.data;

    // Validate deposit belongs to same business unit if provided
    if (depositId) {
      const deposit = await prisma.deposit.findUnique({ where: { id: depositId }, select: { businessUnitId: true } });
      if (!deposit) {
        return Response.json(apiResponse(false, undefined, "Deposit not found"), { status: 404 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          ...txData,
          orderId,
          businessUnitId: order.businessUnitId,
          createdBy: userId,
        },
        include: { currency: { select: { id: true, code: true, symbol: true } } },
      });

      // Atomic deposit deduction if deposit-based payment
      if (depositId) {
        await deductDeposit(tx, depositId, txData.amountOriginal, created.id);
      }

      // Recalculate order status based on all transactions
      await recalculateOrderStatus(orderId, tx);

      await createAuditLog(tx, userId, "CREATE", "Transaction", created.id, {
        orderId,
        paymentType: txData.paymentType,
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
    console.error("POST /api/orders/[id]/transactions error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

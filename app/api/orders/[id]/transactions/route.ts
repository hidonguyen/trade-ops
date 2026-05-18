// Order transactions: GET list, POST create (with optional deposit deduction + status recalc)
// All multi-step ops are atomic via prisma.$transaction
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse, parsePagination } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createOrderTransactionSchema } from "@/lib/validation-schemas";
import { applyDepositOperation } from "@/lib/deposit-deduction-service";
import { recalculateOrderStatus } from "@/lib/order-status-calculator";
import { checkOverpayment } from "@/lib/overpayment-guard";
import { MSG } from "@/lib/messages";
import { invalidateTags } from "@/lib/cache/invalidate";
import { withCache } from "@/lib/cache/with-cache";
import { TAG, TTL, orderTxListKey } from "@/lib/cache/keys";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id: orderId } = await params;

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { type: true, businessUnitId: true } });
    if (!order) {
      return Response.json(apiResponse(false, undefined, MSG.orderNotFound), { status: 404 });
    }

    const module = order.type === "SALE" ? "SALE" : "PURCHASE";
    if (!checkAccess(session.user.roles, "GET", module, order.businessUnitId)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const { page, limit, skip, order: sortOrder } = parsePagination(searchParams);

    const where = { orderId };
    const { data, total } = await withCache(
      {
        key: orderTxListKey(orderId, `p=${page}:l=${limit}:o=${sortOrder}`),
        tags: [TAG.order(orderId)],
        ttlMs: TTL.orderTxList,
      },
      async () => {
        const [items, count] = await Promise.all([
          prisma.transaction.findMany({
            where,
            include: { currency: { select: { id: true, code: true, symbol: true } }, depositUsages: true },
            orderBy: { transactionDate: sortOrder },
            skip,
            take: limit,
          }),
          prisma.transaction.count({ where }),
        ]);
        return { data: items, total: count };
      }
    );

    return Response.json({
      ...apiResponse(true, data),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/orders/[id]/transactions error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id: orderId } = await params;
  const body = await request.json();

  const validation = createOrderTransactionSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, type: true, businessUnitId: true, partyId: true },
    });
    if (!order) {
      return Response.json(apiResponse(false, undefined, MSG.orderNotFound), { status: 404 });
    }

    const module = order.type === "SALE" ? "SALE" : "PURCHASE";
    if (!checkAccess(session.user.roles, "CREATE", module, order.businessUnitId)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    const userId = session.user.id!;
    const { depositId, ...txData } = validation.data;

    // Validate deposit belongs to the same business unit if provided
    if (depositId) {
      const deposit = await prisma.deposit.findUnique({ where: { id: depositId }, select: { businessUnitId: true } });
      if (!deposit) {
        return Response.json(apiResponse(false, undefined, MSG.depositNotFound), { status: 404 });
      }
      if (deposit.businessUnitId !== order.businessUnitId) {
        return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
      }
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Reject if payment would exceed remaining order balance
      await checkOverpayment(tx, orderId, txData.amountOriginal, txData.paymentType);

      const created = await tx.transaction.create({
        data: {
          ...txData,
          orderId,
          businessUnitId: order.businessUnitId,
          createdBy: userId,
        },
        include: { currency: { select: { id: true, code: true, symbol: true } } },
      });

      // Deposit flow: deduct for PAYMENT, credit (or auto-create) for REFUND
      // Schema ensures ADJUSTMENT never has paymentMethod=DEPOSIT, so cast is safe here
      if (txData.paymentMethod === "DEPOSIT") {
        await applyDepositOperation(tx, {
          paymentType: txData.paymentType as "PAYMENT" | "REFUND",
          depositId: depositId ?? null,
          amountOriginal: txData.amountOriginal,
          transactionId: created.id,
          partyContext: {
            partyId: order.partyId,
            businessUnitId: order.businessUnitId,
            currencyId: txData.currencyId,
          },
          notes: txData.notes ?? null,
        });
      }

      // Recalculate order status based on all transactions
      await recalculateOrderStatus(orderId, tx);

      await createAuditLog(tx, userId, "CREATE", "Transaction", created.id, {
        ...(validation.data as Record<string, unknown>),
        orderId,
      });

      return created;
    });

    const invalidations = [TAG.reportsByBu(result.businessUnitId), TAG.order(orderId)];
    if (depositId) invalidations.push(TAG.partyDeposits(order.partyId));
    invalidateTags(invalidations);
    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === MSG.insufficientDeposit || error.message === MSG.overpaymentExceeded || error.message === MSG.overRefundExceeded)) {
      return Response.json(apiResponse(false, undefined, error.message), { status: 422 });
    }
    console.error("POST /api/orders/[id]/transactions error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

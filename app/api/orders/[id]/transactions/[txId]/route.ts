// Order transaction edit (PATCH) and delete (DELETE with deposit reversal + status recalc)
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { reverseDepositDeduction, applyDepositOperation } from "@/lib/deposit-deduction-service";
import { recalculateOrderStatus } from "@/lib/order-status-calculator";
import { z } from "zod";
import { MSG } from "@/lib/messages";

const updateTransactionSchema = z.object({
  amountOriginal: z.string().optional(),
  amountVnd: z.string().optional(),
  exchangeRate: z.string().optional(),
  bankReference: z.string().max(100).optional(),
  transactionDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  notes: z.string().max(1000).optional(),
  depositId: z.string().uuid().nullable().optional(),
});

type RouteParams = { params: Promise<{ id: string; txId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id: orderId, txId } = await params;
  const body = await request.json();

  const validation = updateTransactionSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const [order, transaction] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        select: { type: true, businessUnitId: true, partyId: true },
      }),
      prisma.transaction.findUnique({ where: { id: txId, orderId }, include: { depositUsages: true } }),
    ]);

    if (!order) return Response.json(apiResponse(false, undefined, MSG.orderNotFound), { status: 404 });
    if (!transaction) return Response.json(apiResponse(false, undefined, MSG.transactionNotFound), { status: 404 });

    const module = order.type === "SALE" ? "SALE" : "PURCHASE";
    if (!checkAccess(session.user.roles, "UPDATE", module)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    const userId = session.user.id!;
    const { depositId, ...updateFields } = validation.data;
    const prevDepositId = transaction.depositUsages[0]?.depositId ?? null;
    const newDepositId = depositId !== undefined ? depositId : prevDepositId;

    const result = await prisma.$transaction(async (tx: any) => {
      // Always reverse existing deposit operations before re-applying
      if (transaction.depositUsages.length > 0) {
        await reverseDepositDeduction(tx, txId);
      }

      const updateData: Record<string, unknown> = {};
      if (updateFields.amountOriginal !== undefined) updateData.amountOriginal = updateFields.amountOriginal;
      if (updateFields.amountVnd !== undefined) updateData.amountVnd = updateFields.amountVnd;
      if (updateFields.exchangeRate !== undefined) updateData.exchangeRate = updateFields.exchangeRate;
      if (updateFields.bankReference !== undefined) updateData.bankReference = updateFields.bankReference;
      if (updateFields.transactionDate !== undefined) updateData.transactionDate = new Date(updateFields.transactionDate);
      if (updateFields.notes !== undefined) updateData.notes = updateFields.notes;

      const updated = await tx.transaction.update({ where: { id: txId }, data: updateData });

      // Re-apply deposit operation using current tx.paymentMethod/paymentType
      if (transaction.paymentMethod === "DEPOSIT") {
        const amount = (updateData.amountOriginal as string | undefined) ?? transaction.amountOriginal.toString();
        await applyDepositOperation(tx, {
          paymentType: transaction.paymentType as "PAYMENT" | "REFUND",
          depositId: newDepositId ?? null,
          amountOriginal: amount,
          transactionId: txId,
          partyContext: {
            partyId: order.partyId,
            businessUnitId: order.businessUnitId,
            currencyId: transaction.currencyId,
          },
        });
      }

      await recalculateOrderStatus(orderId, tx);
      await createAuditLog(tx, userId, "UPDATE", "Transaction", txId, updateData);
      return updated;
    });

    return Response.json(apiResponse(true, result));
  } catch (error) {
    if (error instanceof Error && error.message === MSG.insufficientDeposit) {
      return Response.json(apiResponse(false, undefined, error.message), { status: 422 });
    }
    console.error("PATCH /api/orders/[id]/transactions/[txId] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id: orderId, txId } = await params;

  try {
    const [order, transaction] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId }, select: { type: true } }),
      prisma.transaction.findUnique({ where: { id: txId, orderId }, select: { id: true } }),
    ]);

    if (!order) return Response.json(apiResponse(false, undefined, MSG.orderNotFound), { status: 404 });
    if (!transaction) return Response.json(apiResponse(false, undefined, MSG.transactionNotFound), { status: 404 });

    const module = order.type === "SALE" ? "SALE" : "PURCHASE";
    if (!checkAccess(session.user.roles, "DELETE", module)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    const userId = session.user.id!;
    await prisma.$transaction(async (tx: any) => {
      // Reverse any deposit deductions before deleting
      await reverseDepositDeduction(tx, txId);
      await tx.transaction.delete({ where: { id: txId } });
      await recalculateOrderStatus(orderId, tx);
      await createAuditLog(tx, userId, "DELETE", "Transaction", txId, { orderId });
    });

    return Response.json(apiResponse(true, undefined, "Đã xóa giao dịch"));
  } catch (error) {
    console.error("DELETE /api/orders/[id]/transactions/[txId] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

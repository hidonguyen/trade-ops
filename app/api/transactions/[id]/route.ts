// Standalone transaction edit (PATCH) and delete (DELETE with deposit reversal)
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { reverseDepositDeduction, applyDepositOperation } from "@/lib/deposit-deduction-service";
import { z } from "zod";
import { MSG } from "@/lib/messages";
import { invalidateTags } from "@/lib/cache/invalidate";
import { TAG } from "@/lib/cache/keys";
import { diffForAudit } from "@/lib/audit-diff";
import { decimalString } from "@/lib/validation-schemas";

const updateStandaloneSchema = z.object({
  amountOriginal: decimalString.optional(),
  amountVnd: decimalString.optional(),
  exchangeRate: decimalString.optional(),
  bankReference: z.string().max(100).nullable().optional(),
  transactionDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  notes: z.string().max(1000).nullable().optional(),
  depositId: z.string().uuid().nullable().optional(),
  // partyId required only if switching to DEPOSIT+REFUND with no depositId; not stored on tx
  partyId: z.string().uuid().optional(),
  expenseTypeId: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const validation = updateStandaloneSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id, orderId: null },
      include: { depositUsages: true },
    });
    if (!transaction) {
      return Response.json(apiResponse(false, undefined, MSG.transactionNotFound), { status: 404 });
    }

    const module = transaction.type === "RECEIPT" ? "RECEIPT" : "PAYMENT";
    if (!checkAccess(session.user.roles, "UPDATE", module)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    const userId = session.user.id!;
    const { depositId, partyId, ...updateFields } = validation.data;
    const prevDepositId = transaction.depositUsages[0]?.depositId ?? null;
    const newDepositId = depositId !== undefined ? depositId : prevDepositId;

    const result = await prisma.$transaction(async (tx: any) => {
      if (transaction.depositUsages.length > 0) {
        await reverseDepositDeduction(tx, id);
      }

      const updateData: Record<string, unknown> = {};
      if (updateFields.amountOriginal !== undefined) updateData.amountOriginal = updateFields.amountOriginal;
      if (updateFields.amountVnd !== undefined) updateData.amountVnd = updateFields.amountVnd;
      if (updateFields.exchangeRate !== undefined) updateData.exchangeRate = updateFields.exchangeRate;
      if (updateFields.bankReference !== undefined) updateData.bankReference = updateFields.bankReference;
      if (updateFields.transactionDate !== undefined) updateData.transactionDate = new Date(updateFields.transactionDate);
      if (updateFields.notes !== undefined) updateData.notes = updateFields.notes;
      // expenseTypeId: null clears the FK; undefined means unchanged
      if (updateFields.expenseTypeId !== undefined) updateData.expenseTypeId = updateFields.expenseTypeId;

      const updated = await tx.transaction.update({ where: { id }, data: updateData });

      if (transaction.paymentMethod === "DEPOSIT") {
        const amount = (updateData.amountOriginal as string | undefined) ?? transaction.amountOriginal.toString();
        await applyDepositOperation(tx, {
          paymentType: transaction.paymentType as "PAYMENT" | "REFUND",
          depositId: newDepositId ?? null,
          amountOriginal: amount,
          transactionId: id,
          currencyId: transaction.currencyId,
          partyContext: partyId
            ? {
                partyId,
                businessUnitId: transaction.businessUnitId,
                currencyId: transaction.currencyId,
              }
            : undefined,
        });
      }

      await createAuditLog(
        tx,
        userId,
        "UPDATE",
        "Transaction",
        id,
        diffForAudit(validation.data, transaction as unknown as Record<string, unknown>),
      );
      return updated;
    });

    invalidateTags([TAG.reportsByBu(result.businessUnitId)]);
    return Response.json(apiResponse(true, result));
  } catch (error) {
    if (error instanceof Error && (error.message === MSG.insufficientDeposit || error.message === MSG.depositCurrencyMismatch)) {
      return Response.json(apiResponse(false, undefined, error.message), { status: 422 });
    }
    console.error("PATCH /api/transactions/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id } = await params;

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id, orderId: null },
      select: { id: true, type: true, businessUnitId: true },
    });
    if (!transaction) {
      return Response.json(apiResponse(false, undefined, MSG.transactionNotFound), { status: 404 });
    }

    const module = transaction.type === "RECEIPT" ? "RECEIPT" : "PAYMENT";
    if (!checkAccess(session.user.roles, "DELETE", module)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    const userId = session.user.id!;
    await prisma.$transaction(async (tx: any) => {
      await reverseDepositDeduction(tx, id);
      await tx.transaction.delete({ where: { id } });
      await createAuditLog(tx, userId, "DELETE", "Transaction", id);
    });

    invalidateTags([TAG.reportsByBu(transaction.businessUnitId)]);
    return Response.json(apiResponse(true, undefined, "Đã xóa giao dịch"));
  } catch (error) {
    console.error("DELETE /api/transactions/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

// Standalone transaction edit (PATCH) and delete (DELETE with deposit reversal)
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { reverseDepositDeduction, deductDeposit } from "@/lib/deposit-deduction-service";
import { z } from "zod";

const updateStandaloneSchema = z.object({
  amountOriginal: z.string().optional(),
  amountVnd: z.string().optional(),
  exchangeRate: z.string().optional(),
  bankReference: z.string().max(100).optional(),
  transactionDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  notes: z.string().max(1000).optional(),
  depositId: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const validation = updateStandaloneSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, "Validation failed", validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id, orderId: null },
      include: { depositUsages: true },
    });
    if (!transaction) {
      return Response.json(apiResponse(false, undefined, "Transaction not found"), { status: 404 });
    }

    const module = transaction.type === "RECEIPT" ? "RECEIPT" : "PAYMENT";
    if (!checkAccess(session.user.roles, "UPDATE", module)) {
      return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
    }

    const userId = session.user.id!;
    const { depositId, ...updateFields } = validation.data;
    const prevDepositId = transaction.depositUsages[0]?.depositId ?? null;
    const newDepositId = depositId !== undefined ? depositId : prevDepositId;

    const result = await prisma.$transaction(async (tx) => {
      if (prevDepositId) {
        await reverseDepositDeduction(tx, id);
      }

      const updateData: Record<string, unknown> = {};
      if (updateFields.amountOriginal !== undefined) updateData.amountOriginal = updateFields.amountOriginal;
      if (updateFields.amountVnd !== undefined) updateData.amountVnd = updateFields.amountVnd;
      if (updateFields.exchangeRate !== undefined) updateData.exchangeRate = updateFields.exchangeRate;
      if (updateFields.bankReference !== undefined) updateData.bankReference = updateFields.bankReference;
      if (updateFields.transactionDate !== undefined) updateData.transactionDate = new Date(updateFields.transactionDate);
      if (updateFields.notes !== undefined) updateData.notes = updateFields.notes;

      const updated = await tx.transaction.update({ where: { id }, data: updateData });

      if (newDepositId) {
        const amount = (updateData.amountOriginal as string | undefined) ?? transaction.amountOriginal.toString();
        await deductDeposit(tx, newDepositId, amount, id);
      }

      await createAuditLog(tx, userId, "UPDATE", "Transaction", id, updateData);
      return updated;
    });

    return Response.json(apiResponse(true, result));
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient deposit balance") {
      return Response.json(apiResponse(false, undefined, error.message), { status: 422 });
    }
    console.error("PATCH /api/transactions/[id] error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const { id } = await params;

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id, orderId: null },
      select: { id: true, type: true },
    });
    if (!transaction) {
      return Response.json(apiResponse(false, undefined, "Transaction not found"), { status: 404 });
    }

    const module = transaction.type === "RECEIPT" ? "RECEIPT" : "PAYMENT";
    if (!checkAccess(session.user.roles, "DELETE", module)) {
      return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
    }

    const userId = session.user.id!;
    await prisma.$transaction(async (tx) => {
      await reverseDepositDeduction(tx, id);
      await tx.transaction.delete({ where: { id } });
      await createAuditLog(tx, userId, "DELETE", "Transaction", id);
    });

    return Response.json(apiResponse(true, undefined, "Transaction deleted"));
  } catch (error) {
    console.error("DELETE /api/transactions/[id] error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

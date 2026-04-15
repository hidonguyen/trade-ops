// Order detail (GET) and partial update (PATCH)
// PATCH restricted: only notes/orderDate editable if transactions exist
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";
import { MSG } from "@/lib/messages";

const orderIncludes = {
  party: { select: { id: true, name: true, type: true } },
  currency: { select: { id: true, code: true, symbol: true } },
  businessUnit: { select: { id: true, code: true, name: true } },
  expenseType: { select: { id: true, name: true, isActive: true } },
  transactions: { orderBy: { transactionDate: "desc" as const } },
};

// Only safe fields are always editable; financial fields locked when transactions exist.
// expenseTypeId is always editable (descriptive metadata, not financial).
const updateOrderSchema = z.object({
  notes: z.string().max(1000).optional(),
  orderDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  orderNumber: z.string().min(1).max(50).optional(),
  expenseTypeId: z.string().uuid().nullable().optional(),
  // Below fields only allowed when no transactions exist
  amountOriginal: z.string().optional(),
  partyId: z.string().uuid().optional(),
  currencyId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await prisma.order.findUnique({ where: { id }, include: orderIncludes });
    if (!order) {
      return Response.json(apiResponse(false, undefined, MSG.orderNotFound), { status: 404 });
    }

    const module = order.type === "SALE" ? "SALE" : "PURCHASE";
    if (!checkAccess(session.user.roles, "GET", module)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    return Response.json(apiResponse(true, order));
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const validation = updateOrderSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { transactions: { select: { id: true } } },
    });
    if (!order) {
      return Response.json(apiResponse(false, undefined, MSG.orderNotFound), { status: 404 });
    }

    const module = order.type === "SALE" ? "SALE" : "PURCHASE";
    if (!checkAccess(session.user.roles, "UPDATE", module)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    const hasTransactions = order.transactions.length > 0;
    const { notes, orderDate, orderNumber, expenseTypeId, amountOriginal, partyId, currencyId } = validation.data;

    // Financial fields locked when transactions exist
    if (hasTransactions && (amountOriginal !== undefined || partyId !== undefined || currencyId !== undefined)) {
      return Response.json(
        apiResponse(false, undefined, MSG.cannotModifyFinancial),
        { status: 409 }
      );
    }

    // Reject ExpenseType on SALE orders (match create-time validation)
    if (expenseTypeId && order.type === "SALE") {
      return Response.json(
        apiResponse(false, undefined, MSG.expenseTypeSaleForbidden, {
          expenseTypeId: [MSG.expenseTypeNotApplicable],
        }),
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;
    if (orderDate !== undefined) updateData.orderDate = new Date(orderDate);
    if (orderNumber !== undefined) updateData.orderNumber = orderNumber.trim();
    if (expenseTypeId !== undefined) updateData.expenseTypeId = expenseTypeId;
    if (!hasTransactions) {
      if (amountOriginal !== undefined) updateData.amountOriginal = amountOriginal;
      if (partyId !== undefined) updateData.partyId = partyId;
      if (currencyId !== undefined) updateData.currencyId = currencyId;
    }

    const userId = session.user.id!;
    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.order.update({ where: { id }, data: updateData, include: orderIncludes });
      await createAuditLog(tx, userId, "UPDATE", "Order", id, updateData);
      return updated;
    });

    return Response.json(apiResponse(true, result));
  } catch (error) {
    const e = error as { code?: string };
    if (e?.code === "P2002") {
      return Response.json(
        apiResponse(false, undefined, "Số đơn hàng đã tồn tại cho đối tác này trong đơn vị kinh doanh này", {
          orderNumber: ["Số đơn trùng với đơn hàng khác"],
        }),
        { status: 409 }
      );
    }
    console.error("PATCH /api/orders/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

// Order detail (GET) and partial update (PATCH)
// PATCH restricted: only notes/orderDate editable if transactions exist
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";
import { MSG } from "@/lib/messages";
import { invalidateTags } from "@/lib/cache/invalidate";
import { withCache } from "@/lib/cache/with-cache";
import { TAG, TTL, orderDetailKey } from "@/lib/cache/keys";
import { diffForAudit } from "@/lib/audit-diff";

const orderIncludes = {
  party: { select: { id: true, name: true, type: true } },
  currency: { select: { id: true, code: true, symbol: true } },
  businessUnit: { select: { id: true, code: true, name: true } },
  expenseType: { select: { id: true, name: true, isActive: true } },
  transactions: { orderBy: { transactionDate: "desc" as const } },
};

// Only safe fields are always editable; financial fields locked when transactions exist.
// expenseTypeId is always editable (descriptive metadata, not financial).
// exchangeRate and paymentDueDate are always editable (non-financial metadata).
const updateOrderSchema = z.object({
  notes: z.string().max(1000).optional(),
  orderDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  orderNumber: z.string().min(1).max(50).optional(),
  expenseTypeId: z.string().uuid().nullable().optional(),
  exchangeRate: z.string().optional(),
  paymentDueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
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
    const order = await withCache(
      { key: orderDetailKey(id), tags: [TAG.order(id)], ttlMs: TTL.orderDetail },
      () => prisma.order.findUnique({ where: { id }, include: orderIncludes })
    );
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
      include: { transactions: { select: { id: true, paymentMethod: true } } },
    });
    if (!order) {
      return Response.json(apiResponse(false, undefined, MSG.orderNotFound), { status: 404 });
    }

    const module = order.type === "SALE" ? "SALE" : "PURCHASE";
    if (!checkAccess(session.user.roles, "UPDATE", module)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    const hasTx = order.transactions.length > 0;
    const hasDepositTx = order.transactions.some((t) => t.paymentMethod === "DEPOSIT");
    const { notes, orderDate, orderNumber, expenseTypeId, exchangeRate, paymentDueDate, amountOriginal, partyId, currencyId } = validation.data;

    // Amount + currency locked once any transaction exists (financial integrity)
    if (hasTx && (amountOriginal !== undefined || currencyId !== undefined)) {
      return Response.json(
        apiResponse(false, undefined, MSG.cannotModifyFinancial),
        { status: 409 }
      );
    }
    // Party locked when a deposit-method transaction exists (deposit usage tied to party)
    if (hasDepositTx && partyId !== undefined && partyId !== order.partyId) {
      return Response.json(
        apiResponse(false, undefined, MSG.cannotModifyParty),
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
    if (exchangeRate !== undefined) updateData.exchangeRate = exchangeRate;
    // paymentDueDate: null clears it, date string sets it
    if (paymentDueDate !== undefined) updateData.paymentDueDate = paymentDueDate ? new Date(paymentDueDate) : null;
    if (!hasTx) {
      if (amountOriginal !== undefined) updateData.amountOriginal = amountOriginal;
      if (currencyId !== undefined) updateData.currencyId = currencyId;
    }
    if (!hasDepositTx && partyId !== undefined) {
      updateData.partyId = partyId;
    }

    const userId = session.user.id!;
    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.order.update({ where: { id }, data: updateData, include: orderIncludes });
      await createAuditLog(
        tx,
        userId,
        "UPDATE",
        "Order",
        id,
        diffForAudit(validation.data as Record<string, unknown>, order as unknown as Record<string, unknown>),
      );
      return updated;
    });

    const tags = [TAG.reportsByBu(result.businessUnitId), TAG.order(id), TAG.party(result.partyId)];
    if (order.partyId !== result.partyId) tags.push(TAG.party(order.partyId));
    invalidateTags(tags);
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

// Hard delete an order. Blocked if any Transaction exists (FK + explicit count check).
// ADMIN only. Audit log preserves full snapshot of the deleted order.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  if (!session.user.roles.includes("ADMIN")) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { id } = await params;

  try {
    const order = await prisma.order.findUnique({ where: { id }, include: orderIncludes });
    if (!order) {
      return Response.json(apiResponse(false, undefined, MSG.orderNotFound), { status: 404 });
    }

    const txCount = await prisma.transaction.count({ where: { orderId: id } });
    if (txCount > 0) {
      return Response.json(
        apiResponse(false, undefined, MSG.orderDeleteBlockedHasTransactions),
        { status: 409 }
      );
    }

    const userId = session.user.id!;
    await prisma.$transaction(async (tx: any) => {
      await createAuditLog(
        tx,
        userId,
        "DELETE",
        "Order",
        id,
        { before: order as unknown as Record<string, unknown> }
      );
      await tx.order.delete({ where: { id } });
    });

    invalidateTags([TAG.reportsByBu(order.businessUnitId), TAG.order(id), TAG.party(order.partyId)]);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/orders/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

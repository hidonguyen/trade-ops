// Orders list + create — SALE orders use SALE module, PURCHASE orders use PURCHASE module
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse, parsePagination } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createOrderSchema } from "@/lib/validation-schemas";
import { MSG } from "@/lib/messages";
import { invalidateTags } from "@/lib/cache/invalidate";
import { TAG } from "@/lib/cache/keys";

const orderIncludes = {
  party: { select: { id: true, name: true, type: true } },
  currency: { select: { id: true, code: true, symbol: true } },
  businessUnit: { select: { id: true, code: true, name: true } },
  expenseType: { select: { id: true, name: true, isActive: true } },
};

export async function GET(request: NextRequest) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type"); // SALE | PURCHASE
  const status = searchParams.get("status");
  const businessUnitId = searchParams.get("businessUnitId");
  // Enforce BU scope to prevent cross-BU data leakage
  if (!businessUnitId) {
    return Response.json(apiResponse(false, undefined, MSG.businessUnitRequired), { status: 400 });
  }
  const partyId = searchParams.get("partyId");
  const orderNumber = searchParams.get("orderNumber");
  const expenseTypeId = searchParams.get("expenseTypeId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  // Determine accessible modules
  const canSale = checkAccess(session.user.roles, "GET", "SALE");
  const canPurchase = checkAccess(session.user.roles, "GET", "PURCHASE");
  if (!canSale && !canPurchase) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  // Restrict by requested type or by what user can access
  const allowedTypes: string[] = [];
  if (!type || type === "SALE") { if (canSale) allowedTypes.push("SALE"); }
  if (!type || type === "PURCHASE") { if (canPurchase) allowedTypes.push("PURCHASE"); }
  if (allowedTypes.length === 0) {
    return Response.json(apiResponse(false, undefined, MSG.accessDeniedForType), { status: 403 });
  }

  const userId = session.user.id!;
  const { page, limit, skip, sortBy, order } = parsePagination(searchParams);

  // Build orderDate range filter — validate ISO format before constructing Date
  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
  const parsedFrom = dateFrom && isValidDate(dateFrom) ? new Date(dateFrom) : undefined;
  const parsedTo = dateTo && isValidDate(dateTo) ? new Date(`${dateTo}T23:59:59.999Z`) : undefined;
  const orderDateFilter = (parsedFrom || parsedTo) ? {
    ...(parsedFrom && { gte: parsedFrom }),
    ...(parsedTo && { lte: parsedTo }),
  } : undefined;

  const where = {
    type: { in: allowedTypes },
    ...(status && { status }),
    businessUnitId,
    ...(partyId && { partyId }),
    ...(orderNumber && { orderNumber: { contains: orderNumber, mode: "insensitive" as const } }),
    ...(expenseTypeId && { expenseTypeId }),
    ...(orderDateFilter && { orderDate: orderDateFilter }),
  };

  try {
    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          ...orderIncludes,
          // Include transactions with paymentType=ADJUSTMENT to compute adjustmentTotal
          transactions: {
            where: { paymentType: "ADJUSTMENT" },
            select: { amountOriginal: true },
          },
        },
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // Post-map: sum adjustment transactions per order, remove raw tx array from payload
    const enriched = data.map((o: any) => {
      const { transactions: adjTxs, ...rest } = o;
      let adjustmentTotal = 0;
      if (adjTxs?.length) {
        adjustmentTotal = adjTxs.reduce(
          (sum: number, t: { amountOriginal: unknown }) => sum + parseFloat(String(t.amountOriginal ?? 0)),
          0
        );
      }
      return { ...rest, adjustmentTotal: adjustmentTotal.toFixed(4) };
    });

    return Response.json({
      ...apiResponse(true, enriched),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const body = await request.json();
  const validation = createOrderSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  const userId = session.user.id!;
  const { type } = validation.data;
  const module = type === "SALE" ? "SALE" : "PURCHASE";
  if (!checkAccess(session.user.roles, "CREATE", module)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      // Resolve orderNumber based on BU mode
      const bu = await tx.businessUnit.findUnique({
        where: { id: validation.data.businessUnitId },
        select: { orderNumberMode: true },
      });
      if (!bu) throw new Error(MSG.businessUnitNotFound);

      let orderNumber = validation.data.orderNumber?.trim() || "";
      if (bu.orderNumberMode === "AUTO") {
        // Auto: generate next sequential per (BU, party). Find max numeric existing value, +1.
        // Fall back to 1 if none exists or none parseable as integer.
        const existing = await tx.order.findMany({
          where: {
            businessUnitId: validation.data.businessUnitId,
            partyId: validation.data.partyId,
          },
          select: { orderNumber: true },
        });
        const maxNum = existing.reduce((max: number, o: { orderNumber: string }) => {
          const n = parseInt(o.orderNumber, 10);
          return Number.isFinite(n) && n > max ? n : max;
        }, 0);
        orderNumber = String(maxNum + 1);
      } else {
        // MANUAL: orderNumber required from payload
        if (!orderNumber) {
          const err = new Error("orderNumber is required in MANUAL mode");
          (err as Error & { code?: string }).code = "ORDER_NUMBER_REQUIRED";
          throw err;
        }
      }

      const { orderNumber: _omit, ...rest } = validation.data;
      void _omit;
      const created = await tx.order.create({
        data: { ...rest, orderNumber, createdBy: userId, status: "UNPAID" },
        include: orderIncludes,
      });
      await createAuditLog(tx, userId, "CREATE", "Order", created.id, {
        ...(validation.data as Record<string, unknown>),
        orderNumber,
        status: "UNPAID",
      });
      return created;
    });
    invalidateTags([TAG.reportsByBu(result.businessUnitId)]);
    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    // Prisma P2002 unique constraint violation
    const e = error as { code?: string; message?: string };
    if (e?.code === "P2002") {
      return Response.json(
        apiResponse(false, undefined, "Số đơn hàng đã tồn tại cho đối tác này trong đơn vị kinh doanh này", {
          orderNumber: ["Số đơn trùng với đơn hàng khác"],
        }),
        { status: 409 }
      );
    }
    if (e?.code === "ORDER_NUMBER_REQUIRED") {
      return Response.json(
        apiResponse(false, undefined, "Số đơn hàng là bắt buộc", { orderNumber: ["Số đơn hàng là bắt buộc"] }),
        { status: 400 }
      );
    }
    console.error("POST /api/orders error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

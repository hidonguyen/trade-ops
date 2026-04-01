// Orders list + create — SALE orders use SALE module, PURCHASE orders use PURCHASE module
import { NextRequest } from "next/server";
import { withAuth, checkAccess, apiResponse, parsePagination } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createOrderSchema } from "@/lib/validation-schemas";

const orderIncludes = {
  party: { select: { id: true, name: true, type: true } },
  currency: { select: { id: true, code: true, symbol: true } },
  businessUnit: { select: { id: true, code: true, name: true } },
};

export async function GET(request: NextRequest) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type"); // SALE | PURCHASE
  const status = searchParams.get("status");
  const businessUnitId = searchParams.get("businessUnitId");
  const partyId = searchParams.get("partyId");

  // Determine accessible modules
  const canSale = checkAccess(session.user.roles, "GET", "SALE");
  const canPurchase = checkAccess(session.user.roles, "GET", "PURCHASE");
  if (!canSale && !canPurchase) {
    return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
  }

  // Restrict by requested type or by what user can access
  const allowedTypes: string[] = [];
  if (!type || type === "SALE") { if (canSale) allowedTypes.push("SALE"); }
  if (!type || type === "PURCHASE") { if (canPurchase) allowedTypes.push("PURCHASE"); }
  if (allowedTypes.length === 0) {
    return Response.json(apiResponse(false, undefined, "Access denied for requested type"), { status: 403 });
  }

  const userId = session.user.id!;
  const { page, limit, skip, sortBy, order } = parsePagination(searchParams);

  const where = {
    type: { in: allowedTypes },
    ...(status && { status }),
    ...(businessUnitId && { businessUnitId }),
    ...(partyId && { partyId }),
  };

  try {
    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: orderIncludes,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);
    return Response.json({
      ...apiResponse(true, data),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const body = await request.json();
  const validation = createOrderSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, "Validation failed", validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  const userId = session.user.id!;
  const { type } = validation.data;
  const module = type === "SALE" ? "SALE" : "PURCHASE";
  if (!checkAccess(session.user.roles, "CREATE", module)) {
    return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: { ...validation.data, createdBy: userId, status: "UNPAID" },
        include: orderIncludes,
      });
      await createAuditLog(tx, userId, "CREATE", "Order", created.id, { type, status: "UNPAID" });
      return created;
    });
    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

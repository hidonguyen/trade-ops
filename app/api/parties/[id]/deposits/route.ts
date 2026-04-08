// Deposits list + create for a party — RBAC inherits from parent party type
import { withAuth, checkAccess, apiResponse, parsePagination } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createDepositSchema } from "@/lib/validation-schemas";
import type { RbacAction, RbacModule } from "@/types";

// Resolve RBAC modules for parent party type
function partyModules(type: string): RbacModule[] {
  if (type === "CUSTOMER") return ["CUSTOMER"];
  if (type === "SUPPLIER") return ["SUPPLIER"];
  return ["CUSTOMER", "SUPPLIER"];
}

function hasPartyAccess(roles: string[], action: RbacAction, type: string): boolean {
  const modules = partyModules(type);
  if (action === "GET") return modules.some((mod) => checkAccess(roles, action, mod));
  return modules.every((mod) => checkAccess(roles, action, mod));
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const { id: partyId } = await params;

  try {
    const party = await prisma.party.findFirst({ where: { id: partyId, isActive: true } });
    if (!party) {
      return Response.json(apiResponse(false, undefined, "Party not found"), { status: 404 });
    }

    if (!hasPartyAccess(session.user.roles, "GET", party.type)) {
      return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const { page, limit, skip, order } = parsePagination(searchParams);

    const [data, total] = await prisma.$transaction([
      prisma.deposit.findMany({
        where: { partyId },
        include: {
          currency: { select: { id: true, code: true, symbol: true } },
          businessUnit: { select: { id: true, code: true, name: true } },
        },
        orderBy: { createdAt: order },
        skip,
        take: limit,
      }),
      prisma.deposit.count({ where: { partyId } }),
    ]);

    return Response.json({
      ...apiResponse(true, data),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/parties/[id]/deposits error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const { id: partyId } = await params;

  try {
    const party = await prisma.party.findFirst({ where: { id: partyId, isActive: true } });
    if (!party) {
      return Response.json(apiResponse(false, undefined, "Party not found"), { status: 404 });
    }

    if (!hasPartyAccess(session.user.roles, "CREATE", party.type)) {
      return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
    }

    const body = await request.json();
    const validation = createDepositSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        apiResponse(false, undefined, "Validation failed", validation.error.flatten().fieldErrors as Record<string, string[]>),
        { status: 400 }
      );
    }

    // Verify currency and business unit exist
    const [currency, businessUnit] = await Promise.all([
      prisma.currency.findFirst({ where: { id: validation.data.currencyId, isActive: true } }),
      prisma.businessUnit.findFirst({ where: { id: validation.data.businessUnitId, isActive: true } }),
    ]);
    if (!currency) {
      return Response.json(apiResponse(false, undefined, "Currency not found"), { status: 404 });
    }
    if (!businessUnit) {
      return Response.json(apiResponse(false, undefined, "Business unit not found"), { status: 404 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const created = await tx.deposit.create({
        data: {
          partyId,
          currencyId: validation.data.currencyId,
          businessUnitId: validation.data.businessUnitId,
          amountOriginal: validation.data.amountOriginal,
          // Set remainingOriginal = amountOriginal on creation
          remainingOriginal: validation.data.amountOriginal,
        },
        include: {
          currency: { select: { id: true, code: true, symbol: true } },
          businessUnit: { select: { id: true, code: true, name: true } },
        },
      });
      await createAuditLog(tx, session.user.id!, "CREATE", "Deposit", created.id);
      return created;
    });

    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    console.error("POST /api/parties/[id]/deposits error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

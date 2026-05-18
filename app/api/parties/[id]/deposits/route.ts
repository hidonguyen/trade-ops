// Deposits list + create for a party — RBAC inherits from parent party type
import { withAuth, checkAccess, apiResponse, parsePagination } from "@/lib/api-helpers";
import type { RoleAssignment } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";
import { createAuditLog } from "@/lib/audit";
import { createDepositSchema } from "@/lib/validation-schemas";
import type { RbacAction, RbacModule } from "@/types";
import { MSG } from "@/lib/messages";
import { withCache } from "@/lib/cache/with-cache";
import { TAG, TTL, partyDepositsKey } from "@/lib/cache/keys";
import { invalidateTags } from "@/lib/cache/invalidate";

// Resolve RBAC modules for parent party type
function partyModules(type: string): RbacModule[] {
  if (type === "CUSTOMER") return ["CUSTOMER"];
  if (type === "SUPPLIER") return ["SUPPLIER"];
  return ["CUSTOMER", "SUPPLIER"];
}

function hasPartyAccess(roles: RoleAssignment[], action: RbacAction, type: string, businessUnitId: string | null): boolean {
  const modules = partyModules(type);
  if (action === "GET") return modules.some((mod) => checkAccess(roles, action, mod, businessUnitId));
  return modules.every((mod) => checkAccess(roles, action, mod, businessUnitId));
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id: partyId } = await params;

  try {
    const party = await prisma.party.findFirst({ where: { id: partyId, isActive: true } });
    if (!party) {
      return Response.json(apiResponse(false, undefined, MSG.partyNotFound), { status: 404 });
    }

    if (!hasPartyAccess(session.user.roles, "GET", party.type, party.businessUnitId)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const { page, limit, skip, order } = parsePagination(searchParams);

    const { data, total } = await withCache(
      {
        key: partyDepositsKey(partyId, `p=${page}:l=${limit}:o=${order}`),
        tags: [TAG.partyDeposits(partyId)],
        ttlMs: TTL.partyDeposits,
      },
      async () => {
        const [items, count] = await prisma.$transaction([
          prisma.deposit.findMany({
            where: { partyId },
            include: {
              currency: { select: { id: true, code: true, symbol: true } },
              businessUnit: { select: { id: true, code: true, name: true } },
              usages: { select: { amountOriginal: true } },
            },
            orderBy: { createdAt: order },
            skip,
            take: limit,
          }),
          prisma.deposit.count({ where: { partyId } }),
        ]);
        // Post-map: compute usedAmount/creditedAmount/usageCount, drop raw usages array
        const mapped = items.map((d) => {
          const usedAmount = d.usages
            .filter((u) => Number(u.amountOriginal) > 0)
            .reduce((s, u) => s.plus(new Decimal(String(u.amountOriginal))), new Decimal(0));
          const creditedAmount = d.usages
            .filter((u) => Number(u.amountOriginal) < 0)
            .reduce((s, u) => s.plus(new Decimal(String(u.amountOriginal)).abs()), new Decimal(0));
          const { usages: _usages, ...rest } = d;
          return {
            ...rest,
            usedAmount: usedAmount.toFixed(4),
            creditedAmount: creditedAmount.toFixed(4),
            usageCount: d.usages.length,
          };
        });
        return { data: mapped, total: count };
      }
    );

    return Response.json({
      ...apiResponse(true, data),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/parties/[id]/deposits error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id: partyId } = await params;

  try {
    const party = await prisma.party.findFirst({ where: { id: partyId, isActive: true } });
    if (!party) {
      return Response.json(apiResponse(false, undefined, MSG.partyNotFound), { status: 404 });
    }

    if (!hasPartyAccess(session.user.roles, "CREATE", party.type, party.businessUnitId)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    const body = await request.json();
    const validation = createDepositSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
        { status: 400 }
      );
    }

    // Verify currency and business unit exist
    const [currency, businessUnit] = await Promise.all([
      prisma.currency.findFirst({ where: { id: validation.data.currencyId, isActive: true } }),
      prisma.businessUnit.findFirst({ where: { id: validation.data.businessUnitId, isActive: true } }),
    ]);
    if (!currency) {
      return Response.json(apiResponse(false, undefined, MSG.currencyNotFound), { status: 404 });
    }
    if (!businessUnit) {
      return Response.json(apiResponse(false, undefined, MSG.businessUnitNotFound), { status: 404 });
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
          notes: validation.data.notes?.trim() || null,
        },
        include: {
          currency: { select: { id: true, code: true, symbol: true } },
          businessUnit: { select: { id: true, code: true, name: true } },
        },
      });
      await createAuditLog(
        tx,
        session.user.id!,
        "CREATE",
        "Deposit",
        created.id,
        validation.data as Record<string, unknown>,
      );
      return created;
    });

    invalidateTags([
      TAG.partyDeposits(partyId),
      TAG.party(partyId),
      TAG.reportsByBu(result.businessUnitId),
    ]);
    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    console.error("POST /api/parties/[id]/deposits error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

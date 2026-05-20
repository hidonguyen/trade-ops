// Party detail, update, soft delete — RBAC per party type
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import type { RoleAssignment } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createPartySchema } from "@/lib/validation-schemas";
import type { RbacAction, RbacModule } from "@/types";
import Decimal from "decimal.js";
import { MSG } from "@/lib/messages";
import { invalidateTags } from "@/lib/cache/invalidate";
import { withCache } from "@/lib/cache/with-cache";
import { TAG, TTL, partyDetailKey } from "@/lib/cache/keys";
import { diffForAudit } from "@/lib/audit-diff";

// Map party type → required RBAC module
function partyModule(type: string): RbacModule {
  return type === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER";
}

function hasPartyAccess(roles: RoleAssignment[], action: RbacAction, type: string, businessUnitId: string | null): boolean {
  return checkAccess(roles, action, partyModule(type), businessUnitId);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id } = await params;

  try {
    const party = await withCache(
      {
        key: partyDetailKey(id),
        tags: [TAG.party(id), TAG.partyDeposits(id)],
        ttlMs: TTL.partyDetail,
      },
      () => prisma.party.findFirst({
      where: { id, isActive: true },
      include: {
        businessUnit: { select: { id: true, code: true, name: true } },
        businessUnits: {
          select: { businessUnit: { select: { id: true, code: true, name: true } } },
        },
        deposits: {
          select: {
            id: true,
            currencyId: true,
            amountOriginal: true,
            remainingOriginal: true,
            createdAt: true,
            currency: { select: { id: true, code: true, symbol: true } },
          },
        },
      },
    })
    );

    if (!party) {
      return Response.json(apiResponse(false, undefined, MSG.partyNotFound), { status: 404 });
    }

    if (!hasPartyAccess(session.user.roles, "GET", party.type, party.businessUnitId)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    // Compute deposit summary grouped by currency
    const depositSummary = party.deposits.reduce<Record<string, { currencyCode: string; totalDeposited: string; remainingBalance: string }>>(
      (acc: any, dep: any) => {
        const key = dep.currencyId;
        if (!acc[key]) {
          acc[key] = {
            currencyCode: dep.currency.code,
            totalDeposited: "0",
            remainingBalance: "0",
          };
        }
        acc[key].totalDeposited = new Decimal(acc[key].totalDeposited)
          .plus(new Decimal(dep.amountOriginal.toString()))
          .toFixed(4);
        acc[key].remainingBalance = new Decimal(acc[key].remainingBalance)
          .plus(new Decimal(dep.remainingOriginal.toString()))
          .toFixed(4);
        return acc;
      },
      {}
    );

    return Response.json(apiResponse(true, { ...party, depositSummary: Object.values(depositSummary) }));
  } catch (error) {
    console.error("GET /api/parties/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const validation = createPartySchema.partial().safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.party.findFirst({ where: { id, isActive: true } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, MSG.partyNotFound), { status: 404 });
    }

    // Use effective type: prefer the new type if being changed, else existing
    const effectiveType = validation.data.type ?? existing.type;
    if (!hasPartyAccess(session.user.roles, "UPDATE", effectiveType, existing.businessUnitId)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    // Split M2M ids out of the party patch — they're written into PartyBusinessUnit.
    const { businessUnitIds, ...partyPatch } = validation.data;

    // Resolve effective BU list when caller wants to update sharing:
    // - businessUnitIds undefined → leave M2M untouched
    // - empty array → "Chung tất cả BU" = every active BU (mirrors POST semantics)
    // - non-empty → use given list (origin BU always force-added)
    let resolvedBuIds: string[] | null = null;
    if (businessUnitIds !== undefined) {
      if (businessUnitIds.length === 0) {
        const activeBus = await prisma.businessUnit.findMany({
          where: { isActive: true },
          select: { id: true },
        });
        resolvedBuIds = activeBus.map((b) => b.id);
      } else {
        resolvedBuIds = [...businessUnitIds];
      }
      if (!resolvedBuIds.includes(existing.businessUnitId)) {
        resolvedBuIds.push(existing.businessUnitId);
      }
      resolvedBuIds = [...new Set(resolvedBuIds)];
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.party.update({ where: { id }, data: partyPatch });
      if (resolvedBuIds !== null) {
        await tx.partyBusinessUnit.deleteMany({ where: { partyId: id } });
        await tx.partyBusinessUnit.createMany({
          data: resolvedBuIds.map((bu) => ({ partyId: id, businessUnitId: bu })),
          skipDuplicates: true,
        });
      }
      await createAuditLog(
        tx,
        session.user.id!,
        "UPDATE",
        "Party",
        id,
        diffForAudit(validation.data, existing as Record<string, unknown>),
      );
      return updated;
    });
    // Invalidate catalog + any per-BU reports (party name/type appears in aggregations).
    invalidateTags([TAG.parties, TAG.party(id), TAG.reportsByBu(existing.businessUnitId)]);
    return Response.json(apiResponse(true, result));
  } catch (error) {
    console.error("PATCH /api/parties/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.party.findFirst({ where: { id, isActive: true } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, MSG.partyNotFound), { status: 404 });
    }

    if (!hasPartyAccess(session.user.roles, "DELETE", existing.type, existing.businessUnitId)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.party.update({ where: { id }, data: { isActive: false } });
      await createAuditLog(tx, session.user.id!, "DELETE", "Party", id);
    });
    invalidateTags([TAG.parties, TAG.party(id), TAG.reportsByBu(existing.businessUnitId)]);
    return Response.json(apiResponse(true, undefined, "Party deleted"));
  } catch (error) {
    console.error("DELETE /api/parties/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

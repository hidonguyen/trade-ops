// Party detail, update, soft delete — RBAC per party type
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createPartySchema } from "@/lib/validation-schemas";
import type { RbacAction, RbacModule } from "@/types";
import Decimal from "decimal.js";

// Resolve required RBAC modules for a party type — BOTH requires access to at least one
function partyModules(type: string): RbacModule[] {
  if (type === "CUSTOMER") return ["CUSTOMER"];
  if (type === "SUPPLIER") return ["SUPPLIER"];
  return ["CUSTOMER", "SUPPLIER"];
}

function hasPartyAccess(roles: string[], action: RbacAction, type: string): boolean {
  const modules = partyModules(type);
  // BOTH: user needs access to ALL relevant modules for write; GET: any one suffices
  if (action === "GET") {
    return modules.some((mod) => checkAccess(roles, action, mod));
  }
  return modules.every((mod) => checkAccess(roles, action, mod));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const { id } = await params;

  try {
    const party = await prisma.party.findFirst({
      where: { id, isActive: true },
      include: {
        businessUnit: { select: { id: true, code: true, name: true } },
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
    });

    if (!party) {
      return Response.json(apiResponse(false, undefined, "Party not found"), { status: 404 });
    }

    if (!hasPartyAccess(session.user.roles, "GET", party.type)) {
      return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
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
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const validation = createPartySchema.partial().safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, "Validation failed", validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.party.findFirst({ where: { id, isActive: true } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, "Party not found"), { status: 404 });
    }

    // Use effective type: prefer the new type if being changed, else existing
    const effectiveType = validation.data.type ?? existing.type;
    if (!hasPartyAccess(session.user.roles, "UPDATE", effectiveType)) {
      return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.party.update({ where: { id }, data: validation.data });
      await createAuditLog(tx, session.user.id!, "UPDATE", "Party", id, validation.data as Record<string, unknown>);
      return updated;
    });
    return Response.json(apiResponse(true, result));
  } catch (error) {
    console.error("PATCH /api/parties/[id] error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.party.findFirst({ where: { id, isActive: true } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, "Party not found"), { status: 404 });
    }

    if (!hasPartyAccess(session.user.roles, "DELETE", existing.type)) {
      return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.party.update({ where: { id }, data: { isActive: false } });
      await createAuditLog(tx, session.user.id!, "DELETE", "Party", id);
    });
    return Response.json(apiResponse(true, undefined, "Party deleted"));
  } catch (error) {
    console.error("DELETE /api/parties/[id] error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

// Business Units list + create — all roles can read, only ADMIN can write
import { withAuth, checkAccess, assignedBusinessUnits, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createBusinessUnitSchema } from "@/lib/validation-schemas";
import { MSG } from "@/lib/messages";
import { withCache } from "@/lib/cache/with-cache";
import { businessUnitsKey, TAG, TTL } from "@/lib/cache/keys";
import { invalidateTags } from "@/lib/cache/invalidate";

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  try {
    const data = await withCache(
      {
        key: `${businessUnitsKey()}:all=${includeInactive}`,
        tags: [TAG.businessUnits],
        ttlMs: TTL.catalog,
      },
      () => prisma.businessUnit.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      })
    );
    // Scope to BUs the caller holds a role in (ADMIN sees all). Filtered
    // per-request, outside withCache, since the cache is shared across users.
    const allowed = assignedBusinessUnits(session.user.roles, data.map((b) => b.id));
    const scoped = data.filter((b) => allowed.includes(b.id));
    return Response.json(apiResponse(true, scoped));
  } catch (error) {
    console.error("GET /api/business-units error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "CREATE", "ADMIN", null)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const body = await request.json();
  const validation = createBusinessUnitSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const created = await tx.businessUnit.create({ data: validation.data });
      await createAuditLog(
        tx,
        session.user.id!,
        "CREATE",
        "BusinessUnit",
        created.id,
        validation.data as Record<string, unknown>,
      );
      return created;
    });
    invalidateTags([TAG.businessUnits]);
    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    console.error("POST /api/business-units error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

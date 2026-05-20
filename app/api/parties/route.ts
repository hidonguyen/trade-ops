// Parties list (with filters + pagination) + create
// RBAC: CUSTOMER type → "CUSTOMER" module, SUPPLIER → "SUPPLIER"
import { withAuth, checkAccess, apiResponse, parsePagination } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createPartySchema } from "@/lib/validation-schemas";
import type { RbacModule } from "@/types";
import { MSG } from "@/lib/messages";
import { withCache } from "@/lib/cache/with-cache";
import { TAG, TTL } from "@/lib/cache/keys";
import { invalidateTags } from "@/lib/cache/invalidate";

// Map party type → required RBAC module
function partyModule(type: string): RbacModule {
  return type === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER";
}

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || undefined;
  const businessUnitId = searchParams.get("businessUnitId") || undefined;
  // Enforce BU scope to prevent cross-BU data leakage
  if (!businessUnitId) {
    return Response.json(apiResponse(false, undefined, MSG.businessUnitRequired), { status: 400 });
  }
  const search = searchParams.get("search") || undefined;
  const { page, limit, skip, sortBy, order } = parsePagination(searchParams);

  // Resolve which module(s) to check — if type filter provided, use it; otherwise check CUSTOMER (viewer needs at least one)
  const moduleToCheck: RbacModule = type === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER";
  if (!checkAccess(session.user.roles, "GET", moduleToCheck, businessUnitId)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { isActive: true };
  if (type) where.type = type;
  // Multi-BU: filter via M2M so shared parties show in every BU they're linked to.
  where.businessUnits = { some: { businessUnitId } };
  if (search) where.name = { contains: search, mode: "insensitive" };

  // Cache key includes all filter/pagination params so distinct queries get distinct entries.
  const cacheKey = `catalog:parties:t=${type ?? "all"}:bu=${businessUnitId ?? "all"}:q=${search ?? ""}:p=${page}:l=${limit}:s=${sortBy}:o=${order}`;

  try {
    const { data, total } = await withCache(
      { key: cacheKey, tags: [TAG.parties], ttlMs: TTL.parties },
      async () => {
        const [items, count] = await prisma.$transaction([
          prisma.party.findMany({
            where,
            include: {
              businessUnit: { select: { id: true, code: true, name: true } },
              businessUnits: {
                select: { businessUnit: { select: { id: true, code: true, name: true } } },
              },
            },
            orderBy: { [sortBy]: order },
            skip,
            take: limit,
          }),
          prisma.party.count({ where }),
        ]);
        return { data: items, total: count };
      }
    );

    return Response.json({
      ...apiResponse(true, data),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/parties error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const body = await request.json();
  const validation = createPartySchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  // Check CREATE access for the single module derived from party type
  if (!checkAccess(session.user.roles, "CREATE", partyModule(validation.data.type), validation.data.businessUnitId)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  // Verify business unit exists
  const businessUnit = await prisma.businessUnit.findFirst({
    where: { id: validation.data.businessUnitId, isActive: true },
  });
  if (!businessUnit) {
    return Response.json(apiResponse(false, undefined, MSG.businessUnitNotFound), { status: 404 });
  }

  try {
    // Resolve effective BU list:
    // - explicit `businessUnitIds` provided → use as-is (must include origin BU)
    // - omitted/empty → "Chung tất cả BU" = every active BU at creation time
    const { businessUnitIds, ...partyFields } = validation.data;
    let buIds = businessUnitIds && businessUnitIds.length > 0 ? [...new Set(businessUnitIds)] : null;
    if (buIds === null) {
      const activeBus = await prisma.businessUnit.findMany({ where: { isActive: true }, select: { id: true } });
      buIds = activeBus.map((b) => b.id);
    }
    if (!buIds.includes(partyFields.businessUnitId)) buIds.push(partyFields.businessUnitId);

    const result = await prisma.$transaction(async (tx: any) => {
      const created = await tx.party.create({ data: partyFields });
      await tx.partyBusinessUnit.createMany({
        data: buIds.map((id) => ({ partyId: created.id, businessUnitId: id })),
        skipDuplicates: true,
      });
      await createAuditLog(
        tx,
        session.user.id!,
        "CREATE",
        "Party",
        created.id,
        { ...partyFields, businessUnitIds: buIds } as Record<string, unknown>,
      );
      return created;
    });
    invalidateTags([TAG.parties]);
    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    console.error("POST /api/parties error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

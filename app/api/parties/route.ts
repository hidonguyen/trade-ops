// Parties list (with filters + pagination) + create
// RBAC: CUSTOMER type → "CUSTOMER" module, SUPPLIER → "SUPPLIER", BOTH → checks both
import { withAuth, checkAccess, apiResponse, parsePagination } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createPartySchema } from "@/lib/validation-schemas";
import type { RbacModule } from "@/types";
import { MSG } from "@/lib/messages";

// Determine which RBAC modules are required for a given party type
function partyModules(type: string): RbacModule[] {
  if (type === "CUSTOMER") return ["CUSTOMER"];
  if (type === "SUPPLIER") return ["SUPPLIER"];
  return ["CUSTOMER", "SUPPLIER"]; // BOTH requires access to at least one
}

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || undefined;
  const businessUnitId = searchParams.get("businessUnitId") || undefined;
  const search = searchParams.get("search") || undefined;
  const { page, limit, skip, sortBy, order } = parsePagination(searchParams);

  // Resolve which module(s) to check — if type filter provided, use it; otherwise check CUSTOMER (viewer needs at least one)
  const moduleToCheck: RbacModule = type === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER";
  if (!checkAccess(session.user.roles, "GET", moduleToCheck)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  // Build where clause
  // CUSTOMER filter also includes BOTH (party is both customer & supplier); same for SUPPLIER
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { isActive: true };
  if (type === "CUSTOMER") where.type = { in: ["CUSTOMER", "BOTH"] };
  else if (type === "SUPPLIER") where.type = { in: ["SUPPLIER", "BOTH"] };
  else if (type) where.type = type;
  if (businessUnitId) where.businessUnitId = businessUnitId;
  if (search) where.name = { contains: search, mode: "insensitive" };

  try {
    const [data, total] = await prisma.$transaction([
      prisma.party.findMany({
        where,
        include: { businessUnit: { select: { id: true, code: true, name: true } } },
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.party.count({ where }),
    ]);

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

  // Check CREATE access for all required modules based on party type
  const modules = partyModules(validation.data.type);
  const hasAccess = modules.every((mod) => checkAccess(session.user.roles, "CREATE", mod));
  if (!hasAccess) {
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
    const result = await prisma.$transaction(async (tx: any) => {
      const created = await tx.party.create({ data: validation.data });
      await createAuditLog(tx, session.user.id!, "CREATE", "Party", created.id);
      return created;
    });
    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    console.error("POST /api/parties error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

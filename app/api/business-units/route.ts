// Business Units list + create — all roles can read, only ADMIN can write
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createBusinessUnitSchema } from "@/lib/validation-schemas";

export async function GET() {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }

  try {
    const data = await prisma.businessUnit.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return Response.json(apiResponse(true, data));
  } catch (error) {
    console.error("GET /api/business-units error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "CREATE", "ADMIN")) {
    return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
  }

  const body = await request.json();
  const validation = createBusinessUnitSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, "Validation failed", validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const created = await tx.businessUnit.create({ data: validation.data });
      await createAuditLog(tx, session.user.id!, "CREATE", "BusinessUnit", created.id);
      return created;
    });
    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    console.error("POST /api/business-units error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

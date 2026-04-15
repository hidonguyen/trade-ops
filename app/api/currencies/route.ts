// Currencies list + create — all roles can read, only ADMIN can write
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createCurrencySchema } from "@/lib/validation-schemas";
import { MSG } from "@/lib/messages";

export async function GET() {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  try {
    const data = await prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });
    return Response.json(apiResponse(true, data));
  } catch (error) {
    console.error("GET /api/currencies error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "CREATE", "ADMIN")) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const body = await request.json();
  const validation = createCurrencySchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const created = await tx.currency.create({ data: validation.data });
      await createAuditLog(tx, session.user.id!, "CREATE", "Currency", created.id);
      return created;
    });
    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    console.error("POST /api/currencies error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

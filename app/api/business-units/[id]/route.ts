// Business Unit update + soft delete — only ADMIN can write
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createBusinessUnitSchema } from "@/lib/validation-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "UPDATE", "ADMIN")) {
    return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const validation = createBusinessUnitSchema.partial().safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, "Validation failed", validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.businessUnit.findFirst({ where: { id, isActive: true } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, "Business unit not found"), { status: 404 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.businessUnit.update({ where: { id }, data: validation.data });
      await createAuditLog(tx, session.user.id!, "UPDATE", "BusinessUnit", id, validation.data as Record<string, unknown>);
      return updated;
    });
    return Response.json(apiResponse(true, result));
  } catch (error) {
    console.error("PATCH /api/business-units/[id] error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, "Unauthorized"), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "DELETE", "ADMIN")) {
    return Response.json(apiResponse(false, undefined, "Access denied"), { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.businessUnit.findFirst({ where: { id, isActive: true } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, "Business unit not found"), { status: 404 });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.businessUnit.update({ where: { id }, data: { isActive: false } });
      await createAuditLog(tx, session.user.id!, "DELETE", "BusinessUnit", id);
    });
    return Response.json(apiResponse(true, undefined, "Business unit deleted"));
  } catch (error) {
    console.error("DELETE /api/business-units/[id] error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

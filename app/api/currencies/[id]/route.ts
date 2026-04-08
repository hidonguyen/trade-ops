// Currency update + soft delete — only ADMIN can write
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createCurrencySchema } from "@/lib/validation-schemas";

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
  const validation = createCurrencySchema.partial().safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, "Validation failed", validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.currency.findFirst({ where: { id, isActive: true } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, "Currency not found"), { status: 404 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.currency.update({ where: { id }, data: validation.data });
      await createAuditLog(tx, session.user.id!, "UPDATE", "Currency", id, validation.data as Record<string, unknown>);
      return updated;
    });
    return Response.json(apiResponse(true, result));
  } catch (error) {
    console.error("PATCH /api/currencies/[id] error:", error);
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
    const existing = await prisma.currency.findFirst({ where: { id, isActive: true } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, "Currency not found"), { status: 404 });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.currency.update({ where: { id }, data: { isActive: false } });
      await createAuditLog(tx, session.user.id!, "DELETE", "Currency", id);
    });
    return Response.json(apiResponse(true, undefined, "Currency deleted"));
  } catch (error) {
    console.error("DELETE /api/currencies/[id] error:", error);
    return Response.json(apiResponse(false, undefined, "Internal server error"), { status: 500 });
  }
}

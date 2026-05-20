// Contact detail + update + soft delete (ADMIN-only mutations).
// Soft delete = isActive=false; hard delete blocked if any Transaction references it.
import { withAuth, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createContactSchema } from "@/lib/validation-schemas";
import { MSG } from "@/lib/messages";
import { invalidateTags } from "@/lib/cache/invalidate";
import { TAG } from "@/lib/cache/keys";
import { diffForAudit } from "@/lib/audit-diff";
import { canWriteContact } from "@/lib/contact-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      _count: { select: { transactions: true } },
      businessUnits: {
        select: { businessUnit: { select: { id: true, code: true, name: true } } },
      },
    },
  });
  if (!contact) {
    return Response.json(apiResponse(false, undefined, MSG.contactNotFound), { status: 404 });
  }
  return Response.json(apiResponse(true, contact));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!canWriteContact(session.user.roles, "UPDATE")) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const validation = createContactSchema.partial().safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  const { businessUnitIds, ...rest } = validation.data;
  const data = normalizeContactInput(rest);

  try {
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, MSG.contactNotFound), { status: 404 });
    }

    // Resolve sharing update (mirrors Party PATCH):
    // - undefined → leave M2M untouched
    // - empty array → "Chung tất cả BU" = every active BU
    // - non-empty → use given list
    let resolvedBuIds: string[] | null = null;
    if (businessUnitIds !== undefined) {
      if (businessUnitIds.length === 0) {
        const activeBus = await prisma.businessUnit.findMany({
          where: { isActive: true },
          select: { id: true },
        });
        resolvedBuIds = activeBus.map((b) => b.id);
      } else {
        resolvedBuIds = [...new Set(businessUnitIds)];
      }
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.contact.update({ where: { id }, data });
      if (resolvedBuIds !== null) {
        await tx.contactBusinessUnit.deleteMany({ where: { contactId: id } });
        if (resolvedBuIds.length > 0) {
          await tx.contactBusinessUnit.createMany({
            data: resolvedBuIds.map((bu) => ({ contactId: id, businessUnitId: bu })),
            skipDuplicates: true,
          });
        }
      }
      await createAuditLog(
        tx,
        session.user.id!,
        "UPDATE",
        "Contact",
        id,
        diffForAudit(validation.data, existing as Record<string, unknown>)
      );
      return updated;
    });
    invalidateTags([TAG.contacts]);
    return Response.json(apiResponse(true, result));
  } catch (error) {
    console.error("PATCH /api/contacts/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!canWriteContact(session.user.roles, "DELETE")) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { id } = await params;
  try {
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, MSG.contactNotFound), { status: 404 });
    }

    // Hard delete only if no transactions reference it. Otherwise soft-delete (isActive=false).
    const usageCount = await prisma.transaction.count({ where: { contactId: id } });
    await prisma.$transaction(async (tx: any) => {
      if (usageCount > 0) {
        await tx.contact.update({ where: { id }, data: { isActive: false } });
      } else {
        await tx.contact.delete({ where: { id } });
      }
      await createAuditLog(tx, session.user.id!, "DELETE", "Contact", id);
    });
    invalidateTags([TAG.contacts]);
    return Response.json(apiResponse(true, undefined, usageCount > 0 ? "Contact deactivated (referenced)" : "Contact deleted"));
  } catch (error) {
    console.error("DELETE /api/contacts/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

function normalizeContactInput(input: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...input };
  for (const k of ["phone", "email", "taxId", "address", "notes"]) {
    if (out[k] === "") out[k] = null;
  }
  return out;
}

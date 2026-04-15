// User detail + update + soft delete — ADMIN only
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";
import bcrypt from "bcrypt";
import { MSG } from "@/lib/messages";

const patchUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(100).optional(),
  isActive: z.boolean().optional(),
  roles: z
    .array(z.enum(["ADMIN", "ACCOUNTANT_SALE", "ACCOUNTANT_PURCHASE", "ACCOUNTANT_CASHFLOW", "VIEWER"]))
    .min(1)
    .optional(),
});

// Shared select — never returns passwordHash
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { id: true, role: true, assignedAt: true, assignedBy: true } },
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "GET", "ADMIN")) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) {
      return Response.json(apiResponse(false, undefined, MSG.userNotFound), { status: 404 });
    }
    return Response.json(apiResponse(true, user));
  } catch (error) {
    console.error("GET /api/users/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "UPDATE", "ADMIN")) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(apiResponse(false, undefined, "Invalid JSON body"), { status: 400 });
  }

  const validation = patchUserSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  const { name, email, password, isActive, roles } = validation.data;

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, MSG.userNotFound), { status: 404 });
    }

    // Check email uniqueness if changing email
    if (email && email !== existing.email) {
      const clash = await prisma.user.findUnique({ where: { email } });
      if (clash) {
        return Response.json(
          apiResponse(false, undefined, MSG.validationFailed, { email: ["Email already in use"] }),
          { status: 409 }
        );
      }
    }

    const actorId = session.user.id as string;
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password !== undefined) updateData.passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx: any) => {
      // Replace roles atomically if provided
      if (roles !== undefined) {
        await tx.userRoleAssignment.deleteMany({ where: { userId: id } });
        await tx.userRoleAssignment.createMany({
          data: roles.map((role) => ({ userId: id, role, assignedBy: actorId })),
        });
      }

      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        select: USER_SELECT,
      });

      const changes: Record<string, unknown> = { ...updateData };
      if (roles !== undefined) changes.roles = roles;
      // Never log passwordHash in audit
      delete changes.passwordHash;
      await createAuditLog(tx, actorId, "UPDATE", "User", id, changes);
      return updated;
    });

    return Response.json(apiResponse(true, result));
  } catch (error) {
    console.error("PATCH /api/users/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "DELETE", "ADMIN")) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { id } = await params;

  const actorId = session.user.id as string;

  // Prevent self-deletion
  if (id === actorId) {
    return Response.json(apiResponse(false, undefined, "Cannot delete your own account"), { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, MSG.userNotFound), { status: 404 });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({ where: { id }, data: { isActive: false } });
      await createAuditLog(tx, actorId, "DELETE", "User", id);
    });

    return Response.json(apiResponse(true, undefined, "User deactivated"));
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

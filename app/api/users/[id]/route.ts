// User detail + update + soft delete — ADMIN only
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { expandRoleRows } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";
import bcrypt from "bcrypt";
import { MSG } from "@/lib/messages";
import { withCache } from "@/lib/cache/with-cache";
import { userKey, TAG, TTL } from "@/lib/cache/keys";
import { invalidateTags } from "@/lib/cache/invalidate";

const ROLE_ENUM = z.enum(["ADMIN", "ACCOUNTANT_SALE", "ACCOUNTANT_PURCHASE", "ACCOUNTANT_CASHFLOW", "VIEWER"]);

// A user holds one role applied across a set of BUs. `role` + `businessUnitIds`
// are replaced together when `role` is provided; ADMIN ignores businessUnitIds.
const patchUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(100).optional(),
  isActive: z.boolean().optional(),
  role: ROLE_ENUM.optional(),
  businessUnitIds: z.array(z.string().uuid()).optional(),
}).superRefine((val, ctx) => {
  if (val.role !== undefined && val.role !== "ADMIN" && (val.businessUnitIds ?? []).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["businessUnitIds"],
      message: "Vai trò phải được phân quyền ít nhất một đơn vị kinh doanh",
    });
  }
});

// Shared select — never returns passwordHash
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { id: true, role: true, businessUnitId: true, assignedAt: true, assignedBy: true } },
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "GET", "ADMIN", null)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { id } = await params;

  try {
    const user = await withCache(
      { key: userKey(id), tags: [TAG.users, TAG.user(id)], ttlMs: TTL.userDetail },
      () => prisma.user.findUnique({ where: { id }, select: USER_SELECT })
    );
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
  if (!checkAccess(session.user.roles, "UPDATE", "ADMIN", null)) {
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

  const { name, email, password, isActive, role, businessUnitIds } = validation.data;

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
      // Replace role assignments atomically when a role is provided.
      if (role !== undefined) {
        await tx.userRoleAssignment.deleteMany({ where: { userId: id } });
        await tx.userRoleAssignment.createMany({
          data: expandRoleRows(role, businessUnitIds ?? []).map((r) => ({
            userId: id,
            ...r,
            assignedBy: actorId,
          })),
        });
      }

      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        select: USER_SELECT,
      });

      const changes: Record<string, unknown> = { ...updateData };
      if (role !== undefined) {
        changes.role = role;
        changes.businessUnitIds = businessUnitIds ?? [];
      }
      // Never log passwordHash in audit
      delete changes.passwordHash;
      await createAuditLog(tx, actorId, "UPDATE", "User", id, changes);
      return updated;
    });

    invalidateTags([TAG.users, TAG.user(id)]);
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
  if (!checkAccess(session.user.roles, "DELETE", "ADMIN", null)) {
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

    invalidateTags([TAG.users, TAG.user(id)]);
    return Response.json(apiResponse(true, undefined, "User deactivated"));
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

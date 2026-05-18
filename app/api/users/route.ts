// User list + create — ADMIN only
import { withAuth, checkAccess, apiResponse, parsePagination } from "@/lib/api-helpers";
import { expandRoleRows } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";
import bcrypt from "bcrypt";
import { MSG } from "@/lib/messages";
import { withCache } from "@/lib/cache/with-cache";
import { usersListKey, TAG, TTL } from "@/lib/cache/keys";
import { invalidateTags } from "@/lib/cache/invalidate";

const ROLE_ENUM = z.enum(["ADMIN", "ACCOUNTANT_SALE", "ACCOUNTANT_PURCHASE", "ACCOUNTANT_CASHFLOW", "VIEWER"]);

// A user holds one role applied across a set of BUs. ADMIN is global — its
// businessUnitIds are ignored. Every other role needs at least one BU.
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
  role: ROLE_ENUM,
  businessUnitIds: z.array(z.string().uuid()).default([]),
}).superRefine((val, ctx) => {
  if (val.role !== "ADMIN" && val.businessUnitIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["businessUnitIds"],
      message: "Vai trò phải được phân quyền ít nhất một đơn vị kinh doanh",
    });
  }
});

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!checkAccess(session.user.roles, "GET", "ADMIN", null)) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { page, limit, skip, sortBy, order } = parsePagination(searchParams);

  const cacheKey = usersListKey(`p=${page}:l=${limit}:s=${sortBy}:o=${order}`);

  try {
    const { users, total } = await withCache(
      { key: cacheKey, tags: [TAG.users], ttlMs: TTL.userList },
      async () => {
        const [items, count] = await Promise.all([
          prisma.user.findMany({
            skip,
            take: limit,
            orderBy: { [sortBy]: order },
            select: {
              id: true,
              email: true,
              name: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
              roles: {
                select: { id: true, role: true, businessUnitId: true, assignedAt: true, assignedBy: true },
              },
            },
          }),
          prisma.user.count(),
        ]);
        return { users: items, total: count };
      }
    );

    return Response.json({
      ...apiResponse(true, users),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/users error:", error);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(apiResponse(false, undefined, "Invalid JSON body"), { status: 400 });
  }

  const validation = createUserSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  const { email, name, password, role, businessUnitIds } = validation.data;
  const roleRows = expandRoleRows(role, businessUnitIds);

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json(
        apiResponse(false, undefined, MSG.validationFailed, { email: ["Email already in use"] }),
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const actorId = session.user.id as string;

    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          roles: {
            create: roleRows.map((r) => ({ ...r, assignedBy: actorId })),
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          roles: { select: { id: true, role: true, businessUnitId: true, assignedAt: true } },
        },
      });
      await createAuditLog(tx, actorId, "CREATE", "User", user.id, { email, name, role, businessUnitIds });
      return user;
    });

    invalidateTags([TAG.users]);
    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    console.error("POST /api/users error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

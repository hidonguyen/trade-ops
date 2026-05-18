// Audit log list with filters — ADMIN only, read-only
import { withAuth, checkAccess, apiResponse, parsePagination, parseCsvParam } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MSG } from "@/lib/messages";

// userId, model, action excluded from Zod — parsed separately as CSV for multi-select support
const querySchema = z.object({
  dateFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  dateTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
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
  const { page, limit, skip } = parsePagination(searchParams);

  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, parsed.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  const { dateFrom, dateTo } = parsed.data;
  // userId, model, action support multi-select CSV; single value still works
  const userIds = parseCsvParam(searchParams, "userId");
  const models = parseCsvParam(searchParams, "model");
  // action is a Prisma enum — filter to allowed values so an invalid token
  // doesn't silently return zero rows (it would type-check but Prisma would reject).
  const ALLOWED_ACTIONS = ["CREATE", "UPDATE", "DELETE"] as const;
  const actions = parseCsvParam(searchParams, "action")
    .filter((a): a is typeof ALLOWED_ACTIONS[number] => (ALLOWED_ACTIONS as readonly string[]).includes(a));

  // Build timestamp range filter
  const timestampFilter: { gte?: Date; lte?: Date } = {};
  if (dateFrom) timestampFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    timestampFilter.lte = to;
  }

  const where = {
    ...(userIds.length > 0 && { userId: { in: userIds } }),
    ...(models.length > 0 && { model: { in: models } }),
    ...(actions.length > 0 && { action: { in: actions } }),
    ...(Object.keys(timestampFilter).length > 0 && { timestamp: timestampFilter }),
  };

  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return Response.json({
      ...apiResponse(true, logs),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

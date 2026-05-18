// API route utilities: auth wrapper, RBAC check, pagination parser, response builder
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accessibleBusinessUnits } from "@/lib/rbac";
import type { RoleAssignment } from "@/lib/rbac";
import type { RbacModule } from "@/types";
export { checkAccess, checkAccessAnyBu, accessibleBusinessUnits, assignedBusinessUnits, permissionMatrix } from "@/lib/rbac";

// Standard JSON response shape
export function apiResponse<T>(
  success: boolean,
  data?: T,
  message?: string,
  errors?: Record<string, string[]>
) {
  return {
    success,
    ...(data !== undefined && { data }),
    ...(message && { message }),
    ...(errors && { errors }),
  };
}

// Returns session user or null — caller must handle the null case
export async function withAuth() {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}

// Parse a comma-separated query param into a trimmed, non-empty string array.
// Supports both single-value (?key=abc → ["abc"]) and multi-value (?key=abc,def → ["abc","def"]).
// Empty or missing param returns []. Values are IDs or uppercase enums — no comma escaping needed.
export function parseCsvParam(sp: URLSearchParams, key: string): string[] {
  const raw = sp.get(key);
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// Prisma `businessUnitId` where-filter that intersects an optionally requested
// BU with the BUs the user may read for `module`. Use on cross-BU reports so a
// user only ever sees rows from BUs they have access to. Self-defending: a
// requested BU the user cannot access yields `{ in: [] }` (no rows).
// - requestedBuId accessible → that BU.
// - requestedBuId absent → { in: <accessible BUs> } (ADMIN gets all BUs).
export async function buAccessFilter(
  roles: RoleAssignment[],
  module: RbacModule,
  requestedBuId?: string | null,
): Promise<string | { in: string[] }> {
  const allBus = await prisma.businessUnit.findMany({ select: { id: true } });
  const accessible = accessibleBusinessUnits(roles, module, allBus.map((b) => b.id));
  if (requestedBuId) {
    return accessible.includes(requestedBuId) ? requestedBuId : { in: [] };
  }
  return { in: accessible };
}

// Parse and validate pagination query params with safe defaults
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const order = (searchParams.get("order") || "desc") as "asc" | "desc";
  return { page, limit, skip: (page - 1) * limit, sortBy, order };
}

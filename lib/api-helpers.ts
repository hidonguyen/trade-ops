// API route utilities: auth wrapper, RBAC check, pagination parser, response builder
import { auth } from "@/lib/auth";
export { checkAccess, permissionMatrix } from "@/lib/rbac";

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

// Parse and validate pagination query params with safe defaults
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const order = (searchParams.get("order") || "desc") as "asc" | "desc";
  return { page, limit, skip: (page - 1) * limit, sortBy, order };
}

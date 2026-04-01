// API route utilities: auth wrapper, RBAC check, pagination parser, response builder
import { auth } from "@/lib/auth";
import type { RbacAction, RbacModule, RbacPermission } from "@/types";

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

// RBAC permission matrix: role → module → permission level
const permissionMatrix: Record<string, Record<string, RbacPermission>> = {
  ADMIN: {
    SALE: "FULL", PURCHASE: "FULL", CUSTOMER: "FULL", SUPPLIER: "FULL",
    RECEIPT: "FULL", PAYMENT: "FULL", CASHFLOW: "FULL", DASHBOARD: "FULL", ADMIN: "FULL",
  },
  ACCOUNTANT_SALE: {
    SALE: "FULL", PURCHASE: "GET", CUSTOMER: "FULL", SUPPLIER: "GET",
    RECEIPT: "FULL", PAYMENT: "DENY", CASHFLOW: "FULL", DASHBOARD: "FULL", ADMIN: "DENY",
  },
  ACCOUNTANT_PURCHASE: {
    SALE: "GET", PURCHASE: "FULL", CUSTOMER: "GET", SUPPLIER: "FULL",
    RECEIPT: "DENY", PAYMENT: "FULL", CASHFLOW: "FULL", DASHBOARD: "FULL", ADMIN: "DENY",
  },
  ACCOUNTANT_CASHFLOW: {
    SALE: "GET", PURCHASE: "GET", CUSTOMER: "GET", SUPPLIER: "GET",
    RECEIPT: "FULL", PAYMENT: "FULL", CASHFLOW: "FULL", DASHBOARD: "FULL", ADMIN: "DENY",
  },
  VIEWER: {
    SALE: "GET", PURCHASE: "GET", CUSTOMER: "GET", SUPPLIER: "GET",
    RECEIPT: "GET", PAYMENT: "GET", CASHFLOW: "GET", DASHBOARD: "FULL", ADMIN: "DENY",
  },
};

// Returns true if ANY of the user's roles grants sufficient access for the action/module combo
export function checkAccess(
  userRoles: string[],
  action: RbacAction,
  module: RbacModule
): boolean {
  for (const role of userRoles) {
    const perms = permissionMatrix[role];
    if (!perms) continue;

    const permission = perms[module];
    if (!permission || permission === "DENY") continue;
    if (permission === "FULL") return true;
    if (permission === "GET" && action === "GET") return true;
  }
  return false;
}

// Parse and validate pagination query params with safe defaults
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const order = (searchParams.get("order") || "desc") as "asc" | "desc";
  return { page, limit, skip: (page - 1) * limit, sortBy, order };
}

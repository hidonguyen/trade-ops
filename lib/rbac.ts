// RBAC matrix + checkAccess — pure module, safe to import from server and client.
import type { RbacAction, RbacModule, RbacPermission } from "@/types";

export const permissionMatrix: Record<string, Record<string, RbacPermission>> = {
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

export function checkAccess(userRoles: string[], action: RbacAction, module: RbacModule): boolean {
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

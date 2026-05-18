// RBAC matrix + checkAccess — pure module, safe to import from server and client.
import type { RbacAction, RbacModule, RbacPermission } from "@/types";

// A role granted to a user, scoped to a Business Unit.
// businessUnitId === null means a global assignment (ADMIN convention).
export type RoleAssignment = { role: string; businessUnitId: string | null };

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
    // Full access to standalone cashflow RECEIPT/PAYMENT (the /transactions module).
    // Order-linked payments are gated by SALE/PURCHASE = GET above → blocked.
    RECEIPT: "FULL", PAYMENT: "FULL", CASHFLOW: "FULL", DASHBOARD: "FULL", ADMIN: "DENY",
  },
  VIEWER: {
    SALE: "GET", PURCHASE: "GET", CUSTOMER: "GET", SUPPLIER: "GET",
    RECEIPT: "GET", PAYMENT: "GET", CASHFLOW: "GET", DASHBOARD: "FULL", ADMIN: "DENY",
  },
};

// Whether a single permission value satisfies an action.
function permitsAction(permission: RbacPermission | undefined, action: RbacAction): boolean {
  if (!permission || permission === "DENY") return false;
  if (permission === "FULL") return true;
  return permission === "GET" && action === "GET";
}

// An assignment applies to a target BU when it is global (null) or matches the BU.
function appliesToBu(assignment: RoleAssignment, businessUnitId: string | null): boolean {
  return assignment.businessUnitId === null || assignment.businessUnitId === businessUnitId;
}

// Check whether the user may perform `action` on `module` within `businessUnitId`.
// Pass businessUnitId = null for global operations (admin-only pages).
export function checkAccess(
  assignments: RoleAssignment[],
  action: RbacAction,
  module: RbacModule,
  businessUnitId: string | null,
): boolean {
  for (const a of assignments) {
    if (!appliesToBu(a, businessUnitId)) continue;
    if (permitsAction(permissionMatrix[a.role]?.[module], action)) return true;
  }
  return false;
}

// Business Unit ids the user has any (FULL or GET) access to for `module`.
// A global assignment (ADMIN) grants all BUs.
export function accessibleBusinessUnits(
  assignments: RoleAssignment[],
  module: RbacModule,
  allBuIds: string[],
): string[] {
  const result = new Set<string>();
  for (const a of assignments) {
    if (!permitsAction(permissionMatrix[a.role]?.[module], "GET")) continue;
    if (a.businessUnitId === null) return [...allBuIds];
    if (allBuIds.includes(a.businessUnitId)) result.add(a.businessUnitId);
  }
  return [...result];
}

// Whether the user may perform `action` on `module` in at least one BU.
// Use for cross-BU reads (e.g. all-BU reports) where the data set is later
// narrowed by accessibleBusinessUnits.
export function checkAccessAnyBu(
  assignments: RoleAssignment[],
  action: RbacAction,
  module: RbacModule,
): boolean {
  return assignments.some((a) => permitsAction(permissionMatrix[a.role]?.[module], action));
}

// True when the user holds a global ADMIN assignment.
export function isAdmin(assignments: RoleAssignment[]): boolean {
  return assignments.some((a) => a.role === "ADMIN" && a.businessUnitId === null);
}

// Expand a single (role, businessUnitIds) selection into UserRoleAssignment
// rows. ADMIN → one global row (null BU); other roles → one row per BU.
export function expandRoleRows(
  role: string,
  businessUnitIds: string[],
): { role: string; businessUnitId: string | null }[] {
  if (role === "ADMIN") return [{ role, businessUnitId: null }];
  return businessUnitIds.map((businessUnitId) => ({ role, businessUnitId }));
}

// Business Unit ids the user is assigned to under ANY role. A global
// assignment (ADMIN) grants every BU. Use to scope BU selectors so a user
// can never pick a BU they hold no role in.
export function assignedBusinessUnits(
  assignments: RoleAssignment[],
  allBuIds: string[],
): string[] {
  const result = new Set<string>();
  for (const a of assignments) {
    if (a.businessUnitId === null) return [...allBuIds];
    if (allBuIds.includes(a.businessUnitId)) result.add(a.businessUnitId);
  }
  return [...result];
}

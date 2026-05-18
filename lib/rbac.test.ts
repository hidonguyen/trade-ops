import { describe, it, expect } from "vitest";
import {
  checkAccess,
  checkAccessAnyBu,
  accessibleBusinessUnits,
  assignedBusinessUnits,
  expandRoleRows,
  isAdmin,
  type RoleAssignment,
} from "@/lib/rbac";

const TK = "bu-tk";
const NT = "bu-nt";
const ALL = [TK, NT];

const admin: RoleAssignment[] = [{ role: "ADMIN", businessUnitId: null }];
const saleTk: RoleAssignment[] = [{ role: "ACCOUNTANT_SALE", businessUnitId: TK }];
const saleTkViewerNt: RoleAssignment[] = [
  { role: "ACCOUNTANT_SALE", businessUnitId: TK },
  { role: "VIEWER", businessUnitId: NT },
];

describe("checkAccess", () => {
  it("global ADMIN satisfies any BU and module", () => {
    expect(checkAccess(admin, "DELETE", "PAYMENT", TK)).toBe(true);
    expect(checkAccess(admin, "DELETE", "PAYMENT", NT)).toBe(true);
    expect(checkAccess(admin, "GET", "ADMIN", null)).toBe(true);
  });

  it("BU-scoped role grants only within its BU", () => {
    expect(checkAccess(saleTk, "CREATE", "SALE", TK)).toBe(true);
    expect(checkAccess(saleTk, "CREATE", "SALE", NT)).toBe(false);
  });

  it("respects GET-only permission within the scoped BU", () => {
    expect(checkAccess(saleTk, "GET", "PURCHASE", TK)).toBe(true);
    expect(checkAccess(saleTk, "CREATE", "PURCHASE", TK)).toBe(false);
  });

  it("denies DENY-matrix modules", () => {
    expect(checkAccess(saleTk, "GET", "PAYMENT", TK)).toBe(false);
  });

  it("denies unknown roles and admin module for non-admins", () => {
    expect(checkAccess(saleTk, "GET", "ADMIN", TK)).toBe(false);
    expect(checkAccess([{ role: "NOPE", businessUnitId: TK }], "GET", "SALE", TK)).toBe(false);
  });

  it("combines multiple per-BU assignments", () => {
    expect(checkAccess(saleTkViewerNt, "CREATE", "SALE", TK)).toBe(true);
    expect(checkAccess(saleTkViewerNt, "CREATE", "SALE", NT)).toBe(false);
    expect(checkAccess(saleTkViewerNt, "GET", "SALE", NT)).toBe(true);
  });
});

describe("accessibleBusinessUnits", () => {
  it("global ADMIN gets every BU", () => {
    expect(accessibleBusinessUnits(admin, "PAYMENT", ALL).sort()).toEqual([...ALL].sort());
  });

  it("single-BU user gets only that BU", () => {
    expect(accessibleBusinessUnits(saleTk, "SALE", ALL)).toEqual([TK]);
  });

  it("multi-BU user gets the union across assignments", () => {
    expect(accessibleBusinessUnits(saleTkViewerNt, "SALE", ALL).sort()).toEqual([...ALL].sort());
  });

  it("excludes BUs where the module is DENY", () => {
    expect(accessibleBusinessUnits(saleTk, "PAYMENT", ALL)).toEqual([]);
  });

  it("ignores assignments for BUs not in allBuIds", () => {
    expect(accessibleBusinessUnits(saleTk, "SALE", [NT])).toEqual([]);
  });
});

describe("checkAccessAnyBu", () => {
  it("true when the user can act in at least one BU", () => {
    expect(checkAccessAnyBu(saleTk, "CREATE", "SALE")).toBe(true);
  });

  it("false when no assignment permits the action", () => {
    expect(checkAccessAnyBu(saleTk, "CREATE", "PAYMENT")).toBe(false);
  });
});

describe("assignedBusinessUnits", () => {
  it("global ADMIN is assigned to every BU", () => {
    expect(assignedBusinessUnits(admin, ALL).sort()).toEqual([...ALL].sort());
  });

  it("returns BUs the user holds any role in", () => {
    expect(assignedBusinessUnits(saleTk, ALL)).toEqual([TK]);
    expect(assignedBusinessUnits(saleTkViewerNt, ALL).sort()).toEqual([...ALL].sort());
  });

  it("is empty for a user with no assignments", () => {
    expect(assignedBusinessUnits([], ALL)).toEqual([]);
  });

  it("ignores assignments for BUs not in allBuIds", () => {
    expect(assignedBusinessUnits(saleTk, [NT])).toEqual([]);
  });
});

describe("expandRoleRows", () => {
  it("ADMIN expands to a single global row, ignoring BUs", () => {
    expect(expandRoleRows("ADMIN", [TK, NT])).toEqual([{ role: "ADMIN", businessUnitId: null }]);
  });

  it("a non-ADMIN role expands to one row per BU", () => {
    expect(expandRoleRows("VIEWER", [TK, NT])).toEqual([
      { role: "VIEWER", businessUnitId: TK },
      { role: "VIEWER", businessUnitId: NT },
    ]);
  });

  it("a non-ADMIN role with no BUs expands to nothing", () => {
    expect(expandRoleRows("VIEWER", [])).toEqual([]);
  });
});

describe("isAdmin", () => {
  it("true only for a global ADMIN assignment", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(saleTk)).toBe(false);
    expect(isAdmin([{ role: "ADMIN", businessUnitId: TK }])).toBe(false);
  });
});

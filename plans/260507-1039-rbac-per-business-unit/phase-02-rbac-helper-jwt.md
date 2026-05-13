# Phase 02 — RBAC Helper + JWT/Session

**Effort:** 5h | **Status:** planned | **Depends on:** Phase 01

## Changes

### `lib/rbac.ts`
New shape:
```ts
export type RoleAssignment = { role: string; businessUnitId: string | null };

export function checkAccess(
  assignments: RoleAssignment[],
  action: RbacAction,
  module: RbacModule,
  businessUnitId: string | null,  // target BU; null only for global ops (admin pages)
): boolean {
  for (const a of assignments) {
    // Global assignment (ADMIN) satisfies any BU
    if (a.businessUnitId === null || a.businessUnitId === businessUnitId) {
      const perm = permissionMatrix[a.role]?.[module];
      if (perm === "FULL") return true;
      if (perm === "GET" && action === "GET") return true;
    }
  }
  return false;
}

// Helper: list of BUs the user has any non-DENY access to (for list filtering)
export function accessibleBusinessUnits(
  assignments: RoleAssignment[],
  module: RbacModule,
  allBuIds: string[],
): string[] { ... }
```

Keep `permissionMatrix` unchanged.

### `lib/auth.ts`
- `include: { roles: true }` already returns full rows. Map to `{ role, businessUnitId }`.
- `token.roles` becomes `RoleAssignment[]`.
- Session/JWT shape change → bump session schema; force re-login optional (or graceful: detect old shape and refetch).

### `types/`
Update `Session.user.roles` and `JWT` types.

## Todo
- [ ] Update `RoleAssignment` type
- [ ] Refactor `checkAccess` signature
- [ ] Add `accessibleBusinessUnits` helper
- [ ] Update `lib/auth.ts` callbacks
- [ ] Update next-auth module augmentation in `types/`

## Success
- Type checks pass.
- Unit test: ADMIN(null) matches any BU; ACCOUNTANT_SALE(TK) denied on NT.

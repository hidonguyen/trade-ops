# Phase 03 — API Enforcement

**Effort:** 8h | **Status:** planned | **Depends on:** Phase 02

## Strategy
Every API route handler must:
1. Resolve target `businessUnitId` from request — body, query, or by reading the existing record.
2. Call `checkAccess(session.roles, action, module, buId)` → 403 if false.
3. For lookups by id, fetch `businessUnitId` first (cheap), then check.

## Helper
Add to `lib/api-helpers.ts`:
```ts
export async function requireAccess(
  req,
  action: RbacAction,
  module: RbacModule,
  buId: string,
): Promise<Session> { ... }
```

## Routes to update
~101 callsites across:
- `app/api/orders/**`
- `app/api/parties/**`
- `app/api/transactions/**`
- `app/api/deposits/**`
- `app/api/reports/**`
- `app/api/settings/**` (admin-only — global check)

## Audit Procedure
- `grep -rn "checkAccess\|getServerSession" app/api` → checklist
- For each route: identify BU source → patch → smoke test
- Final: `rg "checkAccess\(" app/api | wc -l` matches handler count

## Todo
- [ ] Add `requireAccess` helper
- [ ] Sweep `app/api/orders/**`
- [ ] Sweep `app/api/parties/**`
- [ ] Sweep `app/api/transactions/**`
- [ ] Sweep `app/api/deposits/**`
- [ ] Sweep `app/api/reports/**`
- [ ] Verify each with manual cross-BU request

## Success
ACCOUNTANT_SALE(TK) gets 403 on `POST /api/orders` with `businessUnitId=NT`.

# Phase 03 — API + RBAC Simplification

## Overview
- Priority: P1
- Status: pending (blocked by phase-02)
- Remove the `{ in: ["CUSTOMER", "BOTH"] }` filter expansion and the dual-module RBAC requirement on party endpoints.

## Key Insights
- Filter expansion existed because BOTH parties had to surface in CUSTOMER lists and SUPPLIER lists. After phase-01, every party is exactly one type — exact match suffices.
- Required-modules logic per party type collapses to one module per type.

## Requirements
- `app/api/parties/route.ts`: list filter `where.type = type` (exact match).
- `app/api/parties/[id]/route.ts`: required modules = single module derived from `party.type`.
- No `BOTH` string remains in `app/api/parties/**`.

## Related Code Files
- Modify: `app/api/parties/route.ts` (lines 2, 17, 43, 46-47)
- Modify: `app/api/parties/[id]/route.ts` (lines 14, 23)

## Implementation Steps
1. `app/api/parties/route.ts`:
   - Line 2 / 17: drop any imported BOTH constant or union member.
   - Lines 43, 46-47: replace `{ in: ["CUSTOMER", "BOTH"] }` (and the SUPPLIER counterpart) with direct equality on the requested type.
   - Simplify any conditional that branched on BOTH.
2. `app/api/parties/[id]/route.ts`:
   - Lines 14, 23: required-modules map reduces to `{ CUSTOMER: [...], SUPPLIER: [...] }` — drop the BOTH branch (which previously required both modules).
3. Confirm `pnpm typecheck` clears API errors related to type narrowing.
4. Manual smoke test: list customers, list suppliers, fetch party detail for one of each.

## Todo
- [ ] `parties/route.ts` filter simplified
- [ ] `parties/[id]/route.ts` RBAC simplified
- [ ] Typecheck passes for `app/api/parties/**`
- [ ] Smoke test list + detail endpoints

## Success Criteria
- `grep -rn "BOTH" app/api/parties` empty.
- Customer list and supplier list return only their respective parties.
- Permission denial behavior unchanged for users with single-module access.

## Risk Assessment
- **Medium**: an active session might hit cached UI expecting BOTH parties in customer list. Acceptable post-migration since BOTH no longer exists.
- **Low**: forgetting a place where BOTH was used as fallback default. Mitigation: grep audit.

## Rollback
- `git revert`. Underlying data already migrated; reverting code does not resurrect BOTH parties.

## Next Steps
Unblocks phase-04.

# Phase 02 — Schema Comment + Zod Validation

## Overview
- Priority: P1
- Status: pending (blocked by phase-01)
- Update schema doc comment and zod enum to drop `BOTH`.

## Key Insights
- `Party.type` is `String`, not Postgres enum — no migration DDL beyond comment change.
- Zod is the runtime guard; updating it forces all later code paths to align.

## Requirements
- `prisma/schema.prisma:89` comment lists only `CUSTOMER, SUPPLIER`.
- `lib/validation-schemas.ts:80` zod enum is `z.enum(["CUSTOMER", "SUPPLIER"])`.
- Seed/fixtures (if any) carry no BOTH literals.

## Related Code Files
- Modify: `prisma/schema.prisma` (line 89)
- Modify: `lib/validation-schemas.ts` (line 80)
- Audit: `prisma/seed*.ts`, `scripts/seed*.ts` if present — replace any BOTH usage

## Implementation Steps
1. Edit `prisma/schema.prisma:89`: change comment from `// CUSTOMER, SUPPLIER, BOTH` → `// CUSTOMER, SUPPLIER`.
2. Edit `lib/validation-schemas.ts:80`: `z.enum(["CUSTOMER", "SUPPLIER", "BOTH"])` → `z.enum(["CUSTOMER", "SUPPLIER"])`.
3. `grep -rn "BOTH" prisma scripts` and update any seed fixtures.
4. `pnpm prisma format` to confirm schema parses.
5. `pnpm typecheck` — expect compile errors in api/ui code; those are addressed in phase-03/04.

## Todo
- [ ] Schema comment updated
- [ ] Zod enum updated
- [ ] Seed/fixtures audited
- [ ] `pnpm prisma format` passes

## Success Criteria
- No `BOTH` literal in `prisma/` or `lib/validation-schemas.ts`.
- Schema parses; zod enum compiles.

## Risk Assessment
- **Low**: comment + literal change. Risk is forgetting a seed file. Mitigation: explicit grep step.

## Rollback
- `git revert` the commit.

## Next Steps
Unblocks phase-03.

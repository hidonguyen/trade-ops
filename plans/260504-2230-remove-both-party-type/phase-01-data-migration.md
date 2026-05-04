# Phase 01 — Data Migration: Backfill BOTH Parties

## Overview
- Priority: P1 (BLOCKER)
- Status: pending
- Convert every `Party` row with `type = 'BOTH'` to either `CUSTOMER` or `SUPPLIER` based on activity counts. **Must complete with verified zero BOTH rows before any later phase ships.**

## Key Insights
- `Party.type` is `String`, not enum — no DDL change needed; only data update.
- Existing `Order`, `Deposit`, transaction rows reference parties by `partyId`. They keep their original `partyId`; the row's role is implied by activity, so picking the dominant side avoids reassignment.
- "Dominant side" = `count(orders) + count(deposits)` for each role. CUSTOMER = orders where party acts as buyer + customer deposits. SUPPLIER = orders where party acts as seller + supplier deposits. Tie → default CUSTOMER (revenue-side bias).

## Requirements
- Backup parties table before migration.
- Produce CSV decision log (`party-id`, `name`, `customer_activity`, `supplier_activity`, `chosen_type`) for finance audit.
- Idempotent: re-running script with no BOTH rows is a no-op.
- Dry-run mode (default).

## Architecture
1. Script `scripts/migrate-both-parties.ts` (Node + Prisma client).
2. Reads all `BOTH` parties.
3. For each: counts CUSTOMER-side vs SUPPLIER-side activity via Prisma aggregations.
4. Writes CSV report.
5. With `--apply`: updates `Party.type` in a single transaction.

## Related Code Files
- Create: `scripts/migrate-both-parties.ts`
- Create: `scripts/README-migrate-both-parties.md` (run instructions, rollback recipe)
- Read only: `prisma/schema.prisma` (confirm relations Order/Deposit → Party)

## Implementation Steps
1. Inspect schema for fields disambiguating customer-side vs supplier-side activity (likely `Order.partyId` with order kind/direction, `Deposit.partyId` with `kind`/role). Document chosen disambiguator in script header.
2. Build Prisma query: list parties where `type = 'BOTH'`.
3. For each party, run aggregate count for customer-side and supplier-side activity.
4. Pick winner (tie → CUSTOMER). Append row to CSV.
5. Print summary table to stdout.
6. If `--apply`: wrap updates in `prisma.$transaction`, commit.
7. Re-query `count(*) where type='BOTH'` and assert zero. Exit non-zero if not.

## Todo
- [ ] Take `pg_dump` of `Party` table (and any FK tables for safety): `pg_dump -t '"Party"' ... > backup-parties-260504.sql`
- [ ] Create `scripts/migrate-both-parties.ts` with dry-run default
- [ ] Run dry-run, share CSV with finance for sign-off
- [ ] Run with `--apply` in maintenance window
- [ ] Verify `SELECT count(*) FROM "Party" WHERE type = 'BOTH'` = 0
- [ ] Archive CSV in plan reports folder

## Success Criteria
- Zero BOTH rows in `Party`.
- CSV decision log archived at `plans/260504-2230-remove-both-party-type/reports/migration-decisions.csv`.
- Backup SQL file exists and restore tested in staging.

## Risk Assessment
- **High**: wrong-way conversion semantically misclassifies a party. Mitigation: finance sign-off on dry-run CSV before `--apply`.
- **Medium**: Prisma aggregation misses an activity source. Mitigation: cross-check counts with manual SQL on 2-3 sample parties before bulk apply.
- **Low**: concurrent writes during migration. Mitigation: run in maintenance window; transaction.

## Rollback
- `psql ... < backup-parties-260504.sql` restores prior `type` values.
- Phase blocks subsequent phases, so reverting this also requires reverting phase-02..04 if they shipped.

## Next Steps
Unblocks phase-02.

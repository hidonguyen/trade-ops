# Phase 01 — Schema: Deposit.source enum + service update

## Context Links
- `prisma/schema.prisma` (Deposit model lines 105-122)
- `lib/deposit-deduction-service.ts` (`createDepositFromRefund` line 79)
- Manual deposit creator: `app/api/parties/[id]/deposits/route.ts`

## Overview
- Priority: P1 (blocks all later phases)
- Status: pending
- Add `source` discriminator to Deposit so reports can distinguish manual deposits from auto-created REFUND deposits without heuristic matching.

## Key Insights
- Heuristic alternative (match DepositUsage → REFUND tx within ms of createdAt) is fragile when refunds are edited or backdated.
- A schema field is strictly additive, indexable, queryable.
- Prisma `String` with check is acceptable; project already uses `String` for `Party.type` rather than enum — follow same convention. Use literal `"MANUAL" | "REFUND"`.

## Requirements
- Functional: every Deposit row has `source`. Reports query by `source` cheaply.
- Non-functional: backfill is idempotent and runs in single migration.

## Architecture
Discriminator written at creation time:
- Manual creator (POST `/api/parties/[id]/deposits`) → `source: "MANUAL"` (default).
- `createDepositFromRefund` → `source: "REFUND"`.

## Files to Modify
- `prisma/schema.prisma` — add field
- `lib/deposit-deduction-service.ts` — set `source: "REFUND"` in `createDepositFromRefund` (line ~90)
- `app/api/parties/[id]/deposits/route.ts` — explicitly set `source: "MANUAL"` (or rely on default)

## Files to Create
- `prisma/migrations/{timestamp}_deposit_source/migration.sql` (auto via `prisma migrate dev`)

## Implementation Steps
1. Edit `prisma/schema.prisma` — under Deposit, add after `notes` field:
   ```
   source            String         @default("MANUAL")  // MANUAL | REFUND
   ```
   Add `@@index([source])` only if query plans show need (skip for now per YAGNI).
2. Run `npx prisma migrate dev --name deposit_source`. Migration generates ALTER TABLE adding column with default MANUAL.
3. Append backfill SQL inside the generated migration file BEFORE applying:
   ```sql
   UPDATE "Deposit" d
   SET source = 'REFUND'
   WHERE EXISTS (
     SELECT 1 FROM "DepositUsage" u
     JOIN "Transaction" t ON t.id = u."transactionId"
     WHERE u."depositId" = d.id
       AND u."amountOriginal" < 0
       AND t."paymentType" = 'REFUND'
       AND ABS(EXTRACT(EPOCH FROM (u."createdAt" - d."createdAt"))) < 5
   );
   ```
   Edge: a manual deposit later credited by a REFUND tx would also have a negative usage. The 5-second window restricts to auto-create path (deposit created in same `$transaction` as the usage). Verify via spot query before commit.
4. Update `lib/deposit-deduction-service.ts` `createDepositFromRefund` (line 90 `tx.deposit.create`):
   ```ts
   data: {
     partyId: args.partyId,
     businessUnitId: args.businessUnitId,
     currencyId: args.currencyId,
     amountOriginal: amount,
     remainingOriginal: amount,
     source: "REFUND",
   },
   ```
5. Run `npx prisma generate`. Verify TS types include `source`.
6. Run `npm run build` to confirm no compile errors.

## Todo List
- [ ] Add `source` field to `Deposit` model in schema
- [ ] Generate migration via `prisma migrate dev --name deposit_source`
- [ ] Edit migration SQL to add backfill UPDATE
- [ ] Update `createDepositFromRefund` to set `source: "REFUND"`
- [ ] Verify manual deposit creator path uses default `MANUAL`
- [ ] Run `prisma generate`
- [ ] Compile check `npm run build`
- [ ] Spot check: `SELECT source, COUNT(*) FROM "Deposit" GROUP BY source` matches expectation

## Success Criteria
- `Deposit.source` non-null on every row.
- New REFUND-path deposits have `source='REFUND'`.
- New manual deposits have `source='MANUAL'`.
- TS type checks pass.

## Risk Assessment
- **Backfill miscategorization (Med/Med)**: The 5s heuristic could miss legacy data with clock skew. Mitigation: pre-run backfill query as SELECT, hand-review counts before migrate.
- **Existing tests breaking (Low/Low)**: field has default → no breaking write. Read paths unaffected.

## Security Considerations
- No new PII. No auth changes.

## Next Steps
- Phase 2 queries `Deposit` with `source: "MANUAL"` filter.

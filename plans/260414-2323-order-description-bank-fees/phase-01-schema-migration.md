# Phase 01 — Schema + Migration: Transaction bankFee fields

## Overview
- Priority: Critical (blocks all downstream phases)
- Status: pending

Add optional bank fee columns to `Transaction`.

## Requirements

- `bankFeeOriginal` `Decimal(18, 4)` nullable — fee in transaction currency.
- `bankFeeVnd` `Decimal(18, 4)` nullable — fee in VND, computed client-side using same `exchangeRate` as `amountVnd`.
- Only populated when `paymentMethod = BANK`. When `paymentMethod = DEPOSIT`, both stay `NULL`.
- Existing rows → `NULL` (backfill not required; treat `NULL` as zero in reports).

## Schema Change (`prisma/schema.prisma`)

```prisma
model Transaction {
  // ... existing fields
  bankFeeOriginal Decimal?  @db.Decimal(18, 4)
  bankFeeVnd      Decimal?  @db.Decimal(18, 4)
  // ... rest
}
```

Add index for bank-fee queries:

```prisma
@@index([businessUnitId, transactionDate, paymentMethod])
```

## Migration

```bash
npx prisma migrate dev --name add_transaction_bank_fee
```

Migration SQL (auto-generated):
- `ALTER TABLE "Transaction" ADD COLUMN "bankFeeOriginal" DECIMAL(18,4)`
- `ALTER TABLE "Transaction" ADD COLUMN "bankFeeVnd" DECIMAL(18,4)`
- `CREATE INDEX ... ON "Transaction" ("businessUnitId","transactionDate","paymentMethod")`

## Files

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_transaction_bank_fee/migration.sql`

## Steps

1. Edit schema — add two nullable Decimal fields + composite index.
2. Run `npx prisma migrate dev --name add_transaction_bank_fee`.
3. Run `npx prisma generate`.
4. Run `npm run type-check` to verify types regenerate.

## Todo

- [ ] Add `bankFeeOriginal`, `bankFeeVnd` to `Transaction`
- [ ] Add composite index on `(businessUnitId, transactionDate, paymentMethod)`
- [ ] Generate + apply migration
- [ ] Regenerate Prisma client
- [ ] `npm run type-check` passes

## Success Criteria

- Migration applies cleanly on dev DB.
- Existing rows show `NULL` for both new columns.
- Prisma client exposes new fields on `Transaction`.

## Risks

- **Prod backfill:** no data change needed since nullable; safe on prod.
- **Index bloat:** composite index only adds one — acceptable.

## Next

→ Phase 02 (API layer consumes new fields).

# Phase 02 — API: Transaction create + report aggregations

## Overview
- Priority: Critical
- Status: pending
- Depends on: Phase 01

Extend validation schemas + API routes to accept/return bank fee fields and expose aggregations for reports.

## Requirements

### Validation (`lib/validation-schemas.ts`)

Extend `createOrderTransactionSchema` and `createStandaloneTransactionSchema`:

```ts
bankFeeOriginal: decimalStringOrZero.optional(),
bankFeeVnd: decimalStringOrZero.optional(),
```

Add refinement:
- If `paymentMethod !== "BANK"` → both fee fields must be absent OR zero.
- If `paymentMethod === "BANK"` and fee provided → both required together.

```ts
.refine(
  (d) => d.paymentMethod === "BANK" || (!d.bankFeeOriginal && !d.bankFeeVnd),
  { message: "Bank fee only allowed when paymentMethod is BANK", path: ["bankFeeOriginal"] }
)
.refine(
  (d) => !d.bankFeeOriginal === !d.bankFeeVnd,
  { message: "bankFeeOriginal and bankFeeVnd must be provided together", path: ["bankFeeVnd"] }
)
```

### Routes to modify

- `app/api/orders/[id]/transactions/route.ts` (POST) — persist new fields; do **not** include fee in `paidAmount` calculation (fee is expense, not debt payment).
- `app/api/orders/[id]/route.ts` (GET) — include new fields in `transactions` select (already returns full transaction).
- `app/api/transactions/route.ts` (GET/POST for standalone) — same treatment; fee allowed on `RECEIPT` type with `BANK` method.
- `app/api/orders/[id]/report/route.ts` — include fee if used.

### Report aggregations (update existing routes)

- `app/api/cashflow-report/route.ts` — add per-row `bankFeeVnd`, `netVnd = amountVnd - bankFeeVnd`; add totals.
- `app/api/reports/dashboard/route.ts` — add `totalBankFeeVnd` KPI aggregate.
- `app/api/reports/summary/route.ts` — include bank fee sum per period/BU if present.

### New endpoint

- `app/api/reports/bank-fees/route.ts` (GET) — lists transactions with `bankFeeOriginal IS NOT NULL AND bankFeeOriginal > 0`.
  - Query params: `from`, `to`, `businessUnitId?`, `currencyId?`, `partyId?`, `page`, `limit`.
  - Response: `{ items: [{ transactionId, date, party, order?, method, amountOriginal, currency, bankFeeOriginal, bankFeeVnd, bankReference, notes }], totals: { feeVnd, byCurrency: {...} } }`.
  - RBAC: all roles with `/reports` access.

## Files

- Modify: `lib/validation-schemas.ts`
- Modify: `app/api/orders/[id]/transactions/route.ts`, `app/api/orders/[id]/route.ts`, `app/api/orders/[id]/report/route.ts`
- Modify: `app/api/transactions/route.ts`
- Modify: `app/api/cashflow-report/route.ts`, `app/api/reports/dashboard/route.ts`, `app/api/reports/summary/route.ts`
- Create: `app/api/reports/bank-fees/route.ts`

## Steps

1. Extend zod schemas with refinements.
2. Update transaction POST handlers to persist fee fields.
3. Confirm `paidAmount` recalculation logic unchanged (fee excluded).
4. Update report aggregation queries to compute fee sums.
5. Create `/api/reports/bank-fees` route with pagination + filters.
6. Add audit log entries capture new fields (existing `createAuditLog` serializes `data`).
7. `npm run type-check`.

## Todo

- [ ] Extend validation schemas + refinements
- [ ] POST `/api/orders/[id]/transactions` persists fee
- [ ] POST `/api/transactions` persists fee
- [ ] GET endpoints return fee fields
- [ ] Cashflow report includes `bankFeeVnd`, `netVnd`, totals
- [ ] Dashboard `totalBankFeeVnd` computed
- [ ] Summary report includes fee
- [ ] New `/api/reports/bank-fees` route with filters + pagination
- [ ] Type-check passes

## Success Criteria

- POST with `paymentMethod=BANK` + fee → stored correctly, order `paidAmount` = `amountOriginal` (debt cleared).
- POST with `paymentMethod=DEPOSIT` + fee → 400 validation error.
- POST without fee → stored as `NULL`.
- Reports return correct fee aggregates; `NULL` treated as 0.

## Risks

- **Summary pre-aggregation correctness:** ensure all sum queries treat `NULL` fee as 0 (`COALESCE` or Prisma `?? 0`).
- **Existing cashflow consumers:** adding fields is backward-compatible; verify UI still parses response.

## Security

- Keep RBAC checks identical to existing report endpoints.
- Fee fields don't bypass existing party/BU scoping.

## Next

→ Phase 04 (tx UI), Phase 05 (cashflow UI), Phase 06 (bank-fee page), Phase 07 (dashboard) — parallel.

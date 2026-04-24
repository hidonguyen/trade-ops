# Deposit Edit/Delete Feature Completed

**Date**: 2026-04-24 08:00
**Severity**: Low
**Component**: Deposit Management (Party Deposits API + UI)
**Status**: Resolved

## What Happened

Shipped deposit edit and delete feature with usage-aware guards. Users can now fix data-entry mistakes on deposits without breaking the usage ledger or creating amortization drift on linked transactions.

## Technical Foundation

**Deposit usage tracking is SIGNED:** `DepositUsage.amountOriginal` carries sign: positive = deduction from deposit, negative = credit to deposit. `usedAmount = Σ(positive values)` establishes floor for edit validation. `usageCount > 0` locks currency/BU fields and blocks deletion entirely.

**New error class** `DepositEditError` with codes:
- `LOCKED_HAS_USAGES` (409 Conflict)
- `AMOUNT_BELOW_USED` (400 Bad Request)
- `DELETE_BLOCKED_HAS_USAGES` (409 Conflict)

**GET enrichment**: `/api/parties/[id]/deposits` now returns `usedAmount`, `creditedAmount`, `usageCount` so UI can floor inputs client-side and disable locked controls. All mutations wrapped in `prisma.$transaction`; audit log via `diffForAudit`.

## Secondary Fix Bundled

Editing `ORDER_ADJUSTMENT` transactions incorrectly opened PaymentForm — fixed routing by `paymentType`. Schema for adjustment amounts was rejecting negatives; relaxed to signed non-zero when type is `ORDER_ADJUSTMENT`.

## Files Changed

**New:**
- `app/api/parties/[id]/deposits/[depositId]/route.ts` — PATCH/DELETE endpoints
- `lib/deposit-edit-guard.ts` — validation logic
- `components/deposit-edit-dialog.tsx` — UI with floor enforcement

**Modified:**
- `app/api/parties/[id]/deposits/route.ts` (GET enrichment)
- `components/deposit-list.tsx`
- `lib/validation-schemas.ts`
- `lib/messages.ts`

## Why This Matters

Prevents silent data corruption: without guards, editing a used deposit could drift the amortization on linked orders, or deleting it orphans usage records. Guards are enforced server-side and UX-friendly on client.

## Commits

- `43d6218` docs/plan
- `e62146e` feat deposits edit/delete
- `b6715f9` fix orders adjustment edit

**Status**: DONE

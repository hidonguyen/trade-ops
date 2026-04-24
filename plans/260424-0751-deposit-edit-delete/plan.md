---
title: "Party deposit edit & delete with usage-aware guards"
description: "Add PATCH/DELETE for party deposits with server-side checks against DepositUsage so users can't violate the remaining-balance invariant"
status: completed
priority: P2
effort: ~3h
branch: main
tags: [deposits, parties, api, ui, audit]
created: 2026-04-24
completed: 2026-04-24
blockedBy: []
blocks: []
---

# Plan: Deposit edit & delete

## Context

Deposits currently support CREATE + READ only (`app/api/parties/[id]/deposits/route.ts`). Users need edit/delete to fix mistakes (wrong amount, wrong currency at creation) but the `DepositUsage` ledger already references them, so naive edits could break the remaining-balance invariant.

## Key invariants (must preserve)

- `remainingOriginal = amountOriginal − Σ positiveUsage + Σ |negativeUsage|` is maintained by `deductDeposit`/`creditDeposit` and must stay consistent
- `DepositUsage.amountOriginal` is signed: positive = deduction (PAYMENT+DEPOSIT), negative = credit (REFUND+DEPOSIT)
- A transaction with `paymentMethod=DEPOSIT` referencing a deposit via `DepositUsage` cannot lose its linked deposit

## Decisions (locked)

1. **Delete allowed only when** `DepositUsage.count === 0` for that deposit (no transactions ever touched it). Otherwise 409 + message.
2. **Edit `amountOriginal`:**
   - New amount must be ≥ `usedAmount` where `usedAmount = Σ positiveUsage.amountOriginal` (net deductions already made). Equivalent to: new amount ≥ `amountOriginal − remainingOriginal` in the pure-deduction case; more rigorous formula covers credit-then-deduct histories.
   - On accept: `remainingOriginal += (newAmount − oldAmount)` (delta applied to remaining; usages untouched).
3. **Edit `currencyId` / `businessUnitId`:** allowed only when `DepositUsage.count === 0`. Once used, these are locked (cross-currency deposit swaps would require cascade recompute of tx amountVnd — out of scope).
4. **RBAC:** inherits existing `hasPartyAccess` pattern (UPDATE/DELETE against CUSTOMER/SUPPLIER). ADMIN + ACCOUNTANT_SALE/PURCHASE only (no CASHFLOW — deposits tied to party modules).
5. **Audit:** every edit/delete writes `AuditLog` with before/after diff (use existing `diffForAudit`).
6. **Cache:** invalidate `TAG.partyDeposits(partyId)` + `TAG.party(partyId)` + `TAG.reportsByBu(businessUnitId)` on mutate.

## Scope

- New route file: `app/api/parties/[id]/deposits/[depositId]/route.ts` (PATCH + DELETE)
- Update validation schemas: `updateDepositSchema`
- New lib helper: `lib/deposit-edit-guard.ts` (computes `usedAmount`, `canDelete`, `minAmountForEdit`)
- UI: extend `components/deposit-list.tsx` with edit/delete row actions + `components/deposit-edit-dialog.tsx`
- Messages: new VN strings in `lib/messages.ts`

## Phases

| # | File | Priority | Blockers | Status |
|---|------|----------|----------|--------|
| 01 | phase-01-api-and-guards.md | P2 | — | completed |
| 02 | phase-02-ui-edit-delete.md | P2 | 01 | completed |

## Dependencies

```
01 (API + guards) ──> 02 (UI)
```

## Data Flow

```
User clicks Edit on deposit row
  └─ Dialog prefills amountOriginal + maxDeletableRemaining
  └─ PATCH /api/parties/[id]/deposits/[depositId]
     └─ loadUsages() → usedAmount, creditedAmount
     └─ guard: newAmount ≥ usedAmount; currency/BU locked if usages exist
     └─ prisma.$transaction:
        ├─ deposit.update { amountOriginal, remainingOriginal += delta }
        └─ audit.create

User clicks Delete
  └─ Confirm dialog
  └─ DELETE /api/parties/[id]/deposits/[depositId]
     └─ guard: DepositUsage.count === 0
     └─ prisma.$transaction: deposit.delete + audit
```

## File Ownership

- **API + guards (phase 01):** `app/api/parties/[id]/deposits/[depositId]/route.ts` (new), `lib/deposit-edit-guard.ts` (new), `lib/validation-schemas.ts` (add `updateDepositSchema`), `lib/messages.ts`
- **UI (phase 02):** `components/deposit-list.tsx` (row actions), `components/deposit-edit-dialog.tsx` (new)

## Success Criteria

- Edit deposit amount up: always succeeds; remaining increases by delta
- Edit deposit amount down but ≥ usedAmount: succeeds; remaining decreases by delta
- Edit deposit amount below usedAmount: 400 with clear VN message
- Edit currency/BU on a used deposit: 400 with clear VN message
- Delete unused deposit: succeeds; deposit row removed
- Delete used deposit: 409 with clear VN message
- All existing deposit-linked payments/refunds continue to pass overpayment/remaining checks

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Race condition: concurrent tx deduction while user edits | L | M | `prisma.$transaction` on mutate; re-read usages inside |
| Currency swap silently breaks tx amountVnd | M | H | Lock currency/BU once usages exist |
| Used-amount formula wrong in credit-then-deduct history | M | M | Use `Σ positive − Σ |negative|` but floor at current remaining-derived ceiling |
| UI shows stale remaining after edit | L | L | Refetch list after mutate |

## Security Considerations

- RBAC inherits from party-level modules (ADMIN + sales/purchase accountant)
- Audit log captures all mutations with before/after
- No exposure of other parties' deposits (route scoped to `[id]` = partyId)

## Open Questions

- None. Architecture fits existing patterns.

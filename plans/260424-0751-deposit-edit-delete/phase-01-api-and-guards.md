# Phase 01 — API endpoints + usage-aware guards

---
**Status:** completed
---

## Context Links

- Existing list+create route: `/Users/hido/trade-ops/app/api/parties/[id]/deposits/route.ts`
- Deposit math service: `/Users/hido/trade-ops/lib/deposit-deduction-service.ts`
- Usage ledger: `DepositUsage` model (`prisma/schema.prisma:123`)
- Audit diff helper: `/Users/hido/trade-ops/lib/audit-diff.ts`
- Cache keys: `/Users/hido/trade-ops/lib/cache/keys.ts` (`partyDepositsKey`, `TAG.partyDeposits`)

## Overview

- Priority: P2
- Status: completed
- PATCH + DELETE for individual deposits with guards that respect existing transaction links.

## Key Insights

- `DepositUsage.amountOriginal` is signed — `used = Σ positive`, `credited = Σ |negative|`. Reducing below `used` would make `remainingOriginal` unable to honor existing deductions if any usage is later reversed.
- Currency/BU swap on a deposit with usages would silently break `Transaction.amountVnd` that was computed against original currency; easier to lock than cascade-recompute.
- `remainingOriginal` already persisted — can recompute `used = amountOriginal - remainingOriginal + Σ|negative|` as cross-check, but single source of truth is the `DepositUsage` query inside `$transaction`.

## Requirements

**Functional**

- `PATCH /api/parties/[id]/deposits/[depositId]`:
  - Accepts: `amountOriginal?`, `currencyId?`, `businessUnitId?`
  - Guard: if any `DepositUsage` exists for this deposit → reject `currencyId` / `businessUnitId` changes
  - Guard: new `amountOriginal ≥ usedAmount` (where `usedAmount = Σ positive DepositUsage`)
  - On success: update `amountOriginal`; adjust `remainingOriginal += (newAmount − oldAmount)`
  - Write audit log with before/after diff

- `DELETE /api/parties/[id]/deposits/[depositId]`:
  - Guard: reject if `DepositUsage.count > 0`
  - On success: hard delete + audit log
  - Note: we do NOT soft-delete — schema has no `isActive` on Deposit; follow existing convention

**Non-functional**

- All mutations inside `prisma.$transaction`
- Reuse existing `hasPartyAccess` helper from sibling route for RBAC
- Cache invalidation identical to POST path

## Architecture

```
PATCH/DELETE /api/parties/[id]/deposits/[depositId]
  ├─ auth + load party + checkAccess(UPDATE or DELETE)
  ├─ load deposit (404 if missing or wrong partyId)
  ├─ $transaction:
  │   ├─ load DepositUsage (for guards)
  │   ├─ evaluate guard → throw typed error → 4xx
  │   ├─ deposit.update/delete
  │   └─ auditLog.create
  └─ invalidateTags([partyDeposits, party, reportsByBu])
```

## Related Code Files

**Modify**

- `/Users/hido/trade-ops/lib/validation-schemas.ts` — add `updateDepositSchema`
- `/Users/hido/trade-ops/lib/messages.ts` — add VN messages for:
  - `depositLockedHasUsages` — "Cọc đã có giao dịch liên quan; không thể thay đổi tiền tệ / đơn vị"
  - `depositDeleteBlockedHasUsages` — "Cọc đã được sử dụng; không thể xóa"
  - `depositAmountBelowUsed` — "Số tiền mới phải lớn hơn hoặc bằng phần đã sử dụng ({used})"

**Create**

- `/Users/hido/trade-ops/app/api/parties/[id]/deposits/[depositId]/route.ts` (~140 LOC)
- `/Users/hido/trade-ops/lib/deposit-edit-guard.ts` (~70 LOC)
  - `loadDepositUsageStats(tx, depositId): Promise<{ usedAmount: Decimal, creditedAmount: Decimal, usageCount: number }>`
  - `assertCanEditMetadata(stats)` — throws if `usageCount > 0`
  - `assertNewAmountValid(newAmount, stats)` — throws if `newAmount < usedAmount`
  - `assertCanDelete(stats)` — throws if `usageCount > 0`

## Implementation Steps

1. **`lib/messages.ts`**: add three keys above.

2. **`lib/validation-schemas.ts`**: add
   ```ts
   export const updateDepositSchema = z.object({
     currencyId: z.string().uuid().optional(),
     amountOriginal: decimalString.optional(),
     businessUnitId: z.string().uuid().optional(),
   });
   ```

3. **`lib/deposit-edit-guard.ts`** (new):
   - Pure functions operating on Prisma tx + computed Decimal stats
   - Use `Decimal.js` for sign-safe math
   - Export typed errors (e.g. `class DepositEditError extends Error { code: string }`) so route can map to HTTP status
   - Keep file under ~100 LOC

4. **`app/api/parties/[id]/deposits/[depositId]/route.ts`** (new):
   - Import `hasPartyAccess` pattern from sibling list route (or extract to shared helper `lib/party-access.ts` if desirable — do only if already duplicated)
   - PATCH handler:
     - `safeParse` body with `updateDepositSchema`
     - Load deposit + party (404 checks)
     - RBAC `hasPartyAccess(roles, "UPDATE", party.type)` — add UPDATE/DELETE to RbacAction type if missing (check existing types first)
     - `$transaction`:
       - `loadDepositUsageStats`
       - If body has `currencyId`/`businessUnitId` → `assertCanEditMetadata`
       - If body has `amountOriginal` → `assertNewAmountValid`
       - Build `updateData`:
         - If `amountOriginal` provided: compute `delta = new − old`, set `remainingOriginal: { increment: delta }` (handles negative delta too)
         - Pass through `currencyId`/`businessUnitId` when present
       - `deposit.update` with include relations for response parity with POST
       - `createAuditLog(tx, userId, "UPDATE", "Deposit", depositId, diffForAudit(before, after))`
     - Map `DepositEditError` → 400 with field-keyed error map
     - Invalidate cache tags
   - DELETE handler:
     - RBAC `hasPartyAccess(roles, "DELETE", party.type)`
     - `$transaction`:
       - `assertCanDelete(stats)`
       - `deposit.delete`
       - `createAuditLog(tx, userId, "DELETE", "Deposit", depositId, { ...depositData })`
     - Invalidate cache tags

5. **RbacAction check**: grep `types/` for `UPDATE`/`DELETE` — if missing on party-module actions, add. Existing order routes use these so likely present.

6. Run `npx tsc --noEmit`.

## Todo List

- [x] Add 3 VN messages to `messages.ts`
- [x] Add `updateDepositSchema` to `validation-schemas.ts`
- [x] Create `lib/deposit-edit-guard.ts`
- [x] Create `app/api/parties/[id]/deposits/[depositId]/route.ts` (PATCH + DELETE)
- [x] Verify RBAC actions `UPDATE`/`DELETE` exist on party modules
- [x] Cache invalidation on both handlers
- [x] Audit logs on both handlers
- [x] tsc clean
- [x] Manual smoke test: edit amount up/down/below-used, delete used/unused

## Success Criteria

- PATCH with valid `amountOriginal` persists + updates remaining
- PATCH with `amountOriginal < usedAmount` → 400 with `depositAmountBelowUsed` message
- PATCH with `currencyId` on deposit that has usages → 400 with `depositLockedHasUsages`
- DELETE unused deposit → 200, deposit gone
- DELETE used deposit → 409 with `depositDeleteBlockedHasUsages`
- Audit log rows present for every mutation
- `partyDeposits` cache cleared

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Concurrent edit + new deduction race | L | M | Guard loaded inside same `$transaction` as update; deduct path also uses `$transaction` |
| Audit diff missing Decimal string conversion | L | L | `diffForAudit` already handles Decimal stringification in sibling routes |
| `DepositEditError` leaks stack to client | L | L | Catch → map → apiResponse; never rethrow raw |
| Guard allows delete when only negative (credit-only) usages exist | M | M | `usageCount` includes all signs; credits still mean the deposit is linked to a refund tx |

## Security Considerations

- Scoped to `[id]` = partyId; path mismatch (deposit belongs to different party) → 404
- RBAC enforced per party type module
- Audit trail mandatory

## Next Steps / Dependencies

- Unblocks phase 02 (UI)

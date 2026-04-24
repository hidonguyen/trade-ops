# Phase 02 — UI edit & delete actions on deposit list

---
**Status:** completed
---

## Context Links

- List component: `/Users/hido/trade-ops/components/deposit-list.tsx`
- Create form: `/Users/hido/trade-ops/components/deposit-form.tsx` (pattern reference)
- Phase 01 API: `app/api/parties/[id]/deposits/[depositId]/route.ts`
- Shared confirm dialog: `/Users/hido/trade-ops/components/shared/confirmation-dialog.tsx`

## Overview

- Priority: P2
- Status: completed
- Row-level edit + delete actions on existing deposit table; edit dialog reuses create-form UX where possible.

## Key Insights

- `DepositList` uses shared `DataTable`; add an `actions` column like `OrderTransactionsTable` does
- Editable fields: `amountOriginal` always; `currencyId`/`businessUnitId` only when `usageCount === 0`
- Need to surface `usedAmount` to the UI so user knows the floor for amount edits. Cheapest: API response includes `usageStats` (add to PATCH/GET responses). For GET, extend response post phase 01 or compute client-side from remaining — **decision**: extend the list endpoint response to include `{ usedAmount, usageCount }` per row (small Prisma aggregate, avoids N+1 since we already include usages implicitly via deposit_usage if relation loaded).

## Requirements

**Functional**

- Each row in `DepositList` has two icon buttons: Edit (pencil) + Delete (trash)
- Edit button opens `DepositEditDialog` prefilled with current values
- Dialog displays hint "Đã sử dụng: {usedAmount} — số tiền mới phải ≥ giá trị này"
- Currency / BU selectors disabled when `usageCount > 0` with tooltip "Không thể thay đổi — cọc đã có giao dịch"
- Submit → PATCH; on error show server message
- Delete button → `ConfirmationDialog` "Xóa cọc này?" with warning when `usageCount > 0` (disable delete action, show "Không thể xóa — cọc đã có giao dịch")
- Confirm → DELETE; refresh list on success

**Non-functional**

- Keep `deposit-list.tsx` under 200 LOC — extract dialog to new file
- Reuse existing row-action pattern from `order-transactions-table.tsx`

## Architecture

```
DepositList
  ├─ row action: onClick → setEditing(row) → open DepositEditDialog
  ├─ row action: onClick → setDeleteTarget(row) → open ConfirmationDialog
  └─ refetch on success

DepositEditDialog
  ├─ prefill from props.deposit
  ├─ read-only display of usedAmount + remaining
  ├─ NumberInput for amountOriginal (min = usedAmount)
  ├─ Combobox currency + businessUnit (disabled if usageCount > 0)
  └─ submit → PATCH /api/parties/[partyId]/deposits/[depositId]
```

## Related Code Files

**Modify**

- `/Users/hido/trade-ops/components/deposit-list.tsx` — add row actions, dialog state
- `/Users/hido/trade-ops/app/api/parties/[id]/deposits/route.ts` (GET) — include `_count.usages` + signed-sum aggregate OR post-map. Simplest: add `include: { _count: { select: { usages: true } } }` and keep `usedAmount` computed client-side as `amountOriginal - remainingOriginal + credits` — but without credits available, show `amountOriginal - remainingOriginal` as a safe lower bound. Cleaner: expose `usedAmount` from API.

**Create**

- `/Users/hido/trade-ops/components/deposit-edit-dialog.tsx` (~140 LOC)

## Implementation Steps

1. **GET response enrichment** (`app/api/parties/[id]/deposits/route.ts`):
   - Add to Prisma select: usages grouped sum. Cheapest per-row: use `findMany` with `usages: { select: { amountOriginal: true } }` then post-map:
     ```ts
     const mapped = items.map(d => {
       const used = d.usages.filter(u => +u.amountOriginal > 0).reduce((s, u) => s.plus(u.amountOriginal), new Decimal(0));
       const credited = d.usages.filter(u => +u.amountOriginal < 0).reduce((s, u) => s.plus(new Decimal(u.amountOriginal).abs()), new Decimal(0));
       const { usages: _usages, ...rest } = d;
       return { ...rest, usedAmount: used.toFixed(4), creditedAmount: credited.toFixed(4), usageCount: d.usages.length };
     });
     ```
   - Keep payload compact: drop the raw `usages` array from response

2. **`components/deposit-edit-dialog.tsx`** (new):
   - Props: `open`, `onClose`, `onSuccess`, `partyId`, `deposit` (prefill)
   - Form state: `amountOriginal`, `currencyId`, `businessUnitId`
   - Lookup currencies + business units same way `deposit-form.tsx` does (reuse fetch endpoints)
   - Validate client-side: `new Decimal(form.amountOriginal).greaterThanOrEqualTo(deposit.usedAmount)`
   - Show hint row with `usedAmount` + `remainingOriginal`
   - PATCH `/api/parties/${partyId}/deposits/${deposit.id}` with JSON body
   - Error map: if `errors.amountOriginal` → show under amount field; else general error

3. **`components/deposit-list.tsx`** (modify):
   - Add `actions` column with Pencil + Trash buttons (mirror `order-transactions-table.tsx` pattern)
   - State: `editingDeposit`, `deleteTarget`
   - Trash button disabled when `row.usageCount > 0`; tooltip explains why
   - Pencil opens `DepositEditDialog`
   - Trash opens `ConfirmationDialog` (confirm → `fetch DELETE`)
   - Refetch on either success
   - Keep file under 200 LOC — if ballooning, extract action cell to inline helper

4. Compile-check: `npx tsc --noEmit`

## Todo List

- [x] Enrich GET response with `usedAmount`, `creditedAmount`, `usageCount`
- [x] Create `deposit-edit-dialog.tsx`
- [x] Add row action buttons (edit + delete) to `deposit-list.tsx`
- [x] Disable currency/BU selectors when `usageCount > 0`
- [x] Disable delete button when `usageCount > 0`
- [x] Wire confirmation dialog for delete
- [x] Refetch list on success
- [x] tsc clean
- [x] Manual test: edit amount up/down, edit currency when untouched, blocked when used

## Success Criteria

- Pencil icon opens dialog with prefilled values and `usedAmount` hint
- Reducing amount below `usedAmount` → inline error, no API call
- Amount edit succeeds and list reflects new amount + updated remaining
- Edit dialog disables currency/BU when deposit has usages
- Delete button disabled + tooltip when `usageCount > 0`
- Unused deposits delete cleanly and row disappears

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `usages` payload bloats list response for old deposits with many usages | L | L | Select only `amountOriginal`; aggregate server-side; drop raw array |
| Disabled Combobox visually confusing | L | L | Tooltip + muted style |
| User bypasses client guard via DevTools | — | — | Server guard in phase 01 is the real gate |

## Security Considerations

- Same RBAC as phase 01 — UI reflects server-side access (hide buttons when user lacks UPDATE/DELETE)

## Next Steps / Dependencies

- Completes the plan. No follow-ups identified.

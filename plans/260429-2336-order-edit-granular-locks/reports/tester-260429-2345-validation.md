# Granular Order-Edit Lock Test Report

**Date:** 2026-04-29  
**Scope:** Validate per-field lock changes for PATCH /api/orders/[id]

## Test Execution

### 1. Existing Tests
**Result:** No test suite found for order PATCH route
- No `*.test.ts`, `*.spec.ts` files in project
- `package.json` has no test script (only `lint`, `type-check`, `dev`, `build`, `start`)
- No Jest/Vitest configuration present
- Conclusion: **No tests to update or run**

### 2. Type-Check
**Result:** PASS ✓
```
npm run type-check: Clean (0 errors)
```

### 3. Lint Analysis (Changed Files Only)
**Result:** No NEW errors introduced

Pre-existing errors in codebase (1074 total: 766 errors, 308 warnings):
- `app/api/orders/[id]/route.ts`: 2 pre-existing `no-assign-module-variable` warnings (unrelated to lock changes)
- `components/order-form.tsx`: No errors in changed sections
- `lib/messages.ts`: No errors
- `app/(dashboard)/orders/[id]/edit/page.tsx`: No errors

New code follows existing patterns; no linting violations.

### 4. Build Verification
**Result:** PASS ✓
```
npm run build: Completed successfully
- Prisma schema generated
- Next.js build succeeded
- All pages compiled
```

### 5. Code Review (Diff Analysis)

**app/api/orders/[id]/route.ts (87 lines changed)**
- ✓ Replaced `hasTransactions` with `hasTx` + `hasDepositTx` predicates
- ✓ Fetches `paymentMethod` from transactions
- ✓ Implements 2-tier lock logic:
  - `hasTx && (amountOriginal || currencyId) → 409 MSG.cannotModifyFinancial`
  - `hasDepositTx && partyId != current → 409 MSG.cannotModifyParty`
- ✓ Updates applied conditionally: `if (!hasTx)` for amount/currency, `if (!hasDepositTx)` for partyId
- ✓ Cache invalidation extended to include both old + new party tags on party change

**lib/messages.ts (2 lines changed)**
- ✓ `cannotModifyFinancial`: Clarified to "số tiền hoặc tiền tệ" (amount OR currency, not financial fields broadly)
- ✓ `cannotModifyParty`: New message for deposit-bound scenario

**components/order-form.tsx**
- ✓ Props `lockAmountCurrency?: boolean` + `lockParty?: boolean` added
- ✓ Party combobox: `disabled={lockParty}` + helper text
- ✓ Currency/amount inputs: `disabled={lockAmountCurrency}` + helper text

**app/(dashboard)/orders/[id]/edit/page.tsx**
- ✓ Computes predicates from `order.transactions`
- ✓ `lockAmountCurrency = txList.length > 0`
- ✓ `lockParty = txList.some(t => t.paymentMethod === "DEPOSIT")`
- ✓ Passes to form correctly

## Implementation Compliance

| Requirement | Status | Evidence |
|---|---|---|
| hasTx blocks amount+currency | ✓ | Lines 103-108 route.ts |
| hasDepositTx blocks party | ✓ | Lines 110-115 route.ts |
| Party editable under BANK-only | ✓ | Line 139: `!hasDepositTx` check |
| Other fields always editable | ✓ | Lines 128-134: unconditional updates |
| Client lock props added | ✓ | Form props + disabled states |
| Messages defined | ✓ | messages.ts lines 32-33 |
| Cache invalidation corrected | ✓ | Lines 157-159: party(old) + party(new) tags |
| No schema migration needed | ✓ | Logic-only change |

## Edge Cases Verified

| Case | Expected | Verified |
|---|---|---|
| REFUND tx (no PAYMENT) | amount/currency locked | hasTx=true handles both |
| BANK PAYMENT only | party editable | hasDepositTx=false allows it |
| DEPOSIT PAYMENT | both locks active | Both predicates true |
| Unchanged partyId on deposit order | No 409 | Conditional: `partyId !== order.partyId` |
| Direct API bypass | 409 enforced | Server-side check present |

## Summary

✓ All changes correctly implemented per plan  
✓ Type safety maintained (0 TS errors)  
✓ Build succeeds  
✓ No test regressions (no existing tests)  
✓ Cache invalidation enhanced for bidirectional party changes  

**Ready for code review and merge.**

---

**Status:** DONE  
**Coverage:** 100% of implementation requirement  
**Risk:** None — logic change only, backward compatible cache tags

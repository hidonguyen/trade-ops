# Phase 02 — Refactor API routes + zod schemas

## Overview
- Priority: High
- Status: pending
- Depends on: Phase 01

## Scope

- ~194 `apiResponse(false, undefined, "...")` call sites across `app/api/`.
- `lib/validation-schemas.ts` refinement messages.
- Replace English strings with `MSG.*` constants or helper calls.

## Strategy

1. **Bulk-replace hot strings** (exact substring → MSG constant):
   - `"Unauthorized"` → `MSG.unauthorized`
   - `"Access denied"` → `MSG.accessDenied`
   - `"Validation failed"` → `MSG.validationFailed`
   - `"Internal server error"` → `MSG.internalError`
   - `"Order not found"` → `MSG.orderNotFound`
   - `"Transaction not found"` → `MSG.transactionNotFound`
   - `"Business unit not found"` → `MSG.businessUnitNotFound`
   - `"Currency not found"` → `MSG.currencyNotFound`
   - `"Deposit not found"` → `MSG.depositNotFound`
   - `"Insufficient deposit balance"` → `MSG.insufficientDeposit`
   - etc.

2. **Parameterized messages** — use helpers `notFound("<entity>")` when MSG constant doesn't exist.

3. **Zod schemas** (`lib/validation-schemas.ts`):
   - Replace English `.refine({ message: "..." })` strings.
   - Examples:
     - `"Bank fee only allowed when paymentMethod is BANK"` → `MSG.bankFeeOnlyForBank`
     - `"bankFeeOriginal and bankFeeVnd must be provided together"` → `MSG.bankFeeFieldsPair`
     - `"depositId is required for PAYMENT via DEPOSIT"` → `MSG.depositIdRequiredPayment`
     - `"partyId is required to auto-create a deposit for this refund"` → `MSG.partyIdRequiredRefund`
     - `"expenseTypeId is only allowed on PURCHASE orders"` → `MSG.expenseTypeSaleForbidden`
   - Base zod messages: consider `z.setErrorMap(customMap)` at module load to translate `"Required"`, `"Invalid uuid"`, etc.

## Files

- Modify: All `app/api/**/route.ts` files with English messages.
- Modify: `lib/validation-schemas.ts`

## Steps

1. Add `import { MSG } from "@/lib/messages"` to each modified file.
2. Run targeted find-replace for each of the hot strings above.
3. For route-specific English strings not in MSG: add to MSG or inline VN translation.
4. For zod: replace refinement messages. Optionally set global error map for base messages.
5. `npm run type-check` after each batch.

## Todo

- [ ] Apply hot-string replacements across all API routes
- [ ] Translate route-specific messages (unique ones)
- [ ] Translate zod refinement messages
- [ ] (Optional) Add `z.setErrorMap` for base zod messages
- [ ] Type-check clean after each batch
- [ ] Spot-check: trigger 401, 403, 400 in browser → see VN

## Success Criteria

- No English in response `message` field for any error path.
- Validation error messages in VN (field-level).
- No regression in non-error paths.

## Risks

- Missed occurrences — grep after edits: `grep -rn 'apiResponse(false' app/api/ | grep -v 'MSG\.'`
- Zod error map vs per-field messages may conflict — prefer explicit per-field for clarity.

## Recommended execution

Use batch edits grouped by route folder (e.g. all `app/api/orders/**`, then `app/api/transactions/**`, etc.) to keep commits reviewable.

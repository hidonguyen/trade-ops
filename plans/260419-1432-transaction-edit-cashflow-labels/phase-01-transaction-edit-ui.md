# Phase 01 — Transaction Edit UI + Actions

## Overview
- **Priority:** high
- **Status:** pending
- Add edit/delete buttons to standalone transactions list, enable TransactionForm in dialog edit mode

## Related Code Files
- `components/transaction-form.tsx` — add edit mode (dialog, PATCH call)
- `app/(dashboard)/transactions/page.tsx` — add edit/delete buttons, dialog state
- `app/api/transactions/[id]/route.ts` — fix PATCH schema (nullable bankReference/notes)

## Implementation Steps

### 1. Fix PATCH schema nullable fields
File: `app/api/transactions/[id]/route.ts`
- Add `.nullable()` to `bankReference` and `notes` in `updateStandaloneSchema`
- Add `decimalString` import and use for `amountOriginal`, `amountVnd`, `exchangeRate`

### 2. Update TransactionForm for edit mode
File: `components/transaction-form.tsx`
Currently renders as a page form (router.push on success). For edit mode, wrap in Dialog and support:
- `editingTransaction` prop to pre-fill
- `mode: "create" | "edit"` prop
- In edit: lock type, paymentMethod, currencyId fields
- In edit: PATCH call instead of POST
- In edit: wrapped in Dialog component

### 3. Add edit/delete to transactions list
File: `app/(dashboard)/transactions/page.tsx`
- Add edit button (PencilIcon) + delete button (Trash2Icon) in actions column
- Add delete confirmation dialog
- Add edit state → open TransactionForm dialog in edit mode
- Fetch transaction details on edit click (need exchangeRate, bankFee etc not in list)

## Todo List
- [ ] Fix PATCH schema nullable fields
- [ ] Add edit mode to TransactionForm
- [ ] Add edit/delete buttons to transactions list page
- [ ] Verify compile

## Success Criteria
- Edit button opens pre-filled TransactionForm dialog
- PATCH request sent on save, list refreshes
- Delete button shows confirmation, deletes on confirm
- Type/method/currency locked during edit

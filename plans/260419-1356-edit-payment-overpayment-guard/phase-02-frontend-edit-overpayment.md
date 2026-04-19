# Phase 02 — Frontend Edit Mode + Overpayment UX

## Overview
- **Priority:** high
- **Status:** pending (blocked by phase-01)
- Add edit button to transaction table, reuse PaymentForm in edit mode, show remaining balance hint

## Key Insights
- PaymentForm already has all fields needed — add `editingTransaction` prop to pre-fill
- PATCH API exists, just need to call it instead of POST
- In edit mode: paymentType, paymentMethod, currency are READ-ONLY (changing them would require complex deposit reversal logic the API doesn't support changing)
- balanceOriginal from report endpoint gives remaining amount for client-side hint

## Related Code Files
- `components/payment-form.tsx` — add edit mode
- `app/(dashboard)/orders/[id]/order-transactions-table.tsx` — add edit button
- `app/(dashboard)/orders/[id]/page.tsx` — wire edit state + pass balance info

## Implementation Steps

### 1. Update PaymentForm to support edit mode
File: `components/payment-form.tsx`

Add optional prop:
```ts
editingTransaction?: {
  id: string;
  paymentType: string;
  paymentMethod: string;
  amountOriginal: string;
  exchangeRate: string;
  amountVnd: string;
  bankReference: string | null;
  transactionDate: string;
  notes: string | null;
  bankFeeOriginal: string | null;
  bankFeeVnd: string | null;
};
```

Add optional prop: `maxPaymentAmount?: string` (remaining balance for hint)

Changes:
- Dialog title: "Chỉnh sửa thanh toán" when editing
- Pre-fill form from `editingTransaction` when dialog opens
- Lock paymentType + paymentMethod fields in edit mode (disabled)
- Submit calls PATCH `/api/orders/${orderId}/transactions/${editingTransaction.id}` instead of POST
- Show remaining balance hint near amount field when `maxPaymentAmount` is provided
- Validation: warn (not block) if amount > maxPaymentAmount (server is authority)

### 2. Add edit button to OrderTransactionsTable
File: `app/(dashboard)/orders/[id]/order-transactions-table.tsx`

Add props:
```ts
onEdit?: (transaction: Transaction) => void;
canEdit?: boolean;
```

Add edit button (PencilIcon) next to delete button in actions column.

### 3. Wire edit state in order detail page
File: `app/(dashboard)/orders/[id]/page.tsx`

- Add `editingTx` state
- Pass `onEdit` callback to OrderTransactionsTable
- Pass `editingTransaction` + `maxPaymentAmount` (from summary.balanceOriginal) to PaymentForm
- When editing a PAYMENT tx, maxPaymentAmount = balanceOriginal + editingTx.amountOriginal (since the tx's own amount is part of already-paid)

## Todo List
- [ ] Update PaymentForm with edit mode support
- [ ] Add remaining balance hint in PaymentForm
- [ ] Add edit button to OrderTransactionsTable
- [ ] Wire edit state in order detail page
- [ ] Verify compile succeeds
- [ ] Manual test: create → edit → verify amounts

## Success Criteria
- Edit button visible on each transaction row
- Clicking edit opens PaymentForm pre-filled with transaction data
- paymentType and paymentMethod locked during edit
- Remaining balance hint shown near amount field
- PATCH request sent on save, page refreshes after success
- Server rejects overpayment with clear error message

## Risk Assessment
- Medium: PaymentForm is 390 lines, adding edit mode increases complexity
- Mitigation: edit mode is controlled by single prop, minimal branching

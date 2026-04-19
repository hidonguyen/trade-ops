# Phase 01 — Backend Overpayment Guard

## Overview
- **Priority:** high
- **Status:** pending
- Add server-side validation to prevent payment amount exceeding remaining order balance

## Key Insights
- `recalculateOrderStatus` already sums all tx amounts — same logic reusable for guard
- PATCH already reverses deposit ops before re-applying — overpayment check must happen AFTER reversal but BEFORE commit
- Guard only applies to `paymentType === "PAYMENT"`, not REFUND

## Related Code Files
- `app/api/orders/[id]/transactions/route.ts` — POST (create)
- `app/api/orders/[id]/transactions/[txId]/route.ts` — PATCH (update)
- `lib/order-status-calculator.ts` — reference for sum logic
- `lib/messages.ts` — add error message
- `lib/validation-schemas.ts` — no changes needed (validation is business logic, not schema)

## Implementation Steps

### 1. Add overpayment error message
File: `lib/messages.ts`
Add: `overpaymentExceeded: "Số tiền thanh toán vượt quá số tiền còn phải thanh toán"`

### 2. Create overpayment guard utility
File: `lib/overpayment-guard.ts` (new, <30 lines)

```ts
// Check if adding/updating a PAYMENT would exceed order balance
// excludeTxId: when editing, exclude the current tx from the sum
async function checkOverpayment(tx, orderId, newAmountOriginal, paymentType, excludeTxId?)
```

Logic:
1. Skip if paymentType !== "PAYMENT"
2. Fetch order.amountOriginal
3. Sum all existing PAYMENT transactions (exclude `excludeTxId` if editing)
4. Sum all existing REFUND transactions
5. Compute: `existingPaid - existingRefunded + newAmount`
6. If result > orderAmount → throw Error(MSG.overpaymentExceeded)

### 3. Integrate into POST route
File: `app/api/orders/[id]/transactions/route.ts`
Inside `prisma.$transaction`, before `tx.transaction.create`:
```ts
await checkOverpayment(tx, orderId, txData.amountOriginal, txData.paymentType);
```

### 4. Integrate into PATCH route
File: `app/api/orders/[id]/transactions/[txId]/route.ts`
Inside `prisma.$transaction`, after deposit reversal but before `tx.transaction.update`:
```ts
const amount = updateFields.amountOriginal ?? transaction.amountOriginal.toString();
await checkOverpayment(tx, orderId, amount, transaction.paymentType, txId);
```

## Todo List
- [ ] Add overpayment error message to `lib/messages.ts`
- [ ] Create `lib/overpayment-guard.ts`
- [ ] Integrate guard into POST route
- [ ] Integrate guard into PATCH route
- [ ] Verify compile succeeds

## Success Criteria
- POST rejects payment that would make netPaid > orderAmount (422 status)
- PATCH rejects same condition (excluding current tx from sum)
- REFUND transactions are unaffected
- Error message returned in Vietnamese

## Risk Assessment
- Low risk — additive check, no schema changes
- Edge case: concurrent transactions — Prisma `$transaction` serializable isolation handles this

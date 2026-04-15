---
title: Refund via Deposit — auto-create deposit when party has none
created: 2026-04-15
status: completed
blockedBy: []
blocks: []
---

# Overview

When recording a REFUND transaction with `paymentMethod=DEPOSIT`:

- **New semantic:** REFUND + DEPOSIT **credits** the party's deposit (increases balance), not deducts.
- User chooses on UI: pick an existing deposit to credit **or** create a new deposit.
- If party has no matching deposit, only "Tạo cọc mới" is offered.
- PAYMENT + DEPOSIT semantic unchanged (still deducts).
- Applies to order-linked AND standalone transactions.

## Current behavior (to be changed)

- `deductDeposit` is called unconditionally for any `depositId` → decrements deposit regardless of `paymentType`.
- UI forces selecting an existing deposit; blocks submission if party has no deposit.

## Target behavior

| paymentType | paymentMethod | Existing deposit? | Backend action |
|-------------|---------------|-------------------|----------------|
| PAYMENT | DEPOSIT | yes | decrement (unchanged) |
| REFUND | DEPOSIT | yes, user picks one | credit (increment) that deposit |
| REFUND | DEPOSIT | no, user picks "Tạo cọc mới" | create deposit with balance = refund amount |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 01 | Backend: `creditDeposit` + auto-create + reverse logic | completed |
| 02 | Validation schemas: allow `depositId` optional for REFUND + require `partyId` when creating | completed |
| 03 | UI: payment-form + transaction-form — "Tạo cọc mới" option | completed |

## Dependencies

Phase 01 blocks 02 & 03. Phase 02 + 03 can run in parallel after 01.

## Related Files

- `lib/deposit-deduction-service.ts`
- `app/api/orders/[id]/transactions/route.ts`, `app/api/orders/[id]/transactions/[txId]/route.ts` (delete handler)
- `app/api/transactions/route.ts`, `app/api/transactions/[txId]/route.ts`
- `lib/validation-schemas.ts`
- `components/payment-form.tsx`, `components/transaction-form.tsx`

## Security / Access

- Refund + auto-create inherits existing CREATE RBAC on the transaction's module (SALE/PURCHASE/RECEIPT/PAYMENT).
- Auto-created Deposit audit-logged as CREATE.

## Open Questions

- Business Unit for auto-created deposit: taken from order (order-linked) or form's `businessUnitId` (standalone). Confirmed by context, no ambiguity.
- Currency: same as transaction currency.

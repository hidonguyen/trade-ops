# Phase 02 — Adjustment transaction type & effective-value status

## Context Links

- Status calculator: `/Users/hido/trade-ops/lib/order-status-calculator.ts`
- Validation: `/Users/hido/trade-ops/lib/validation-schemas.ts`
- Order report: `/Users/hido/trade-ops/app/api/orders/[id]/report/route.ts`
- Tx create: `/Users/hido/trade-ops/app/api/orders/[id]/transactions/route.ts`
- Tx update: `/Users/hido/trade-ops/app/api/orders/[id]/transactions/[txId]/route.ts`
- Overpayment guard: `/Users/hido/trade-ops/lib/overpayment-guard.ts`

## Overview

- Priority: P1
- Status: completed
- Adds `ORDER_ADJUSTMENT` transaction type, allows signed amounts for it, updates status/balance formula to use effective value.

## Key Insights

- Existing zod schemas use `decimalString` (strictly positive). New type needs `decimalAny` path.
- `recalculateOrderStatus` currently sums `paymentType` PAYMENT/REFUND only. Adjustments are a third bucket — they modify the **order value** side, not the paid side.
- Overpayment guard (`lib/overpayment-guard.ts`) compares new payment against `orderAmount - currentPaid`. Must compare against `effectiveValue - currentPaid` instead.
- Adjustment transactions are single-sided: they have no `paymentType` meaning in the PAYMENT/REFUND sense. Store `paymentType = "PAYMENT"` + `paymentMethod = "BANK"` as placeholder OR extend enum. **Decision:** add a dedicated `paymentType = "ADJUSTMENT"` logical value; keep `paymentMethod` as "BANK" (stored but not meaningful). This avoids breaking the PAYMENT/REFUND filter in `/report`.

## Requirements

**Functional**
- `Transaction.type` now accepts `"ORDER_ADJUSTMENT"` in schemas for order-linked endpoint.
- `amountOriginal` may be negative for `ORDER_ADJUSTMENT`; all other types remain strictly positive.
- `paymentType` for adjustment tx: `"ADJUSTMENT"` sentinel (new enum value in zod enum).
- `paymentMethod` still required but UI hides it — store `"BANK"` by default.
- No bank fee, no deposit linkage for adjustments — fee/deposit fields must be absent.
- `paidAmount` column on Order continues to track PAYMENT − REFUND (no change).
- NEW derived field in report: `adjustmentTotal = Σ amountOriginal where type=ORDER_ADJUSTMENT` (signed).
- `effectiveValue = amountOriginal + adjustmentTotal`.
- `balanceOriginal = max(effectiveValue - paidAmount + refundedAmount, 0)` — refund adds back to balance.
- `recalculateOrderStatus` compares `netPaid = paidAmount - refundedAmount` against `effectiveValue`, not raw `amountOriginal`.
- Overpayment guard uses `effectiveValue - currentNetPaid` as the max for new payments.

**Non-functional**
- Prisma transaction safety preserved (all status recalcs inside `$transaction`).
- No i18n leak — type label handled in UI phase.

## Architecture

```
Tx create/update (order-linked)
  ├─ schema: refine(type === ORDER_ADJUSTMENT ? decimalAny : decimalString)
  ├─ schema: reject bankFee* and depositId when type === ORDER_ADJUSTMENT
  └─ post-write: recalcOrderStatus(orderId, tx)
                   ├─ sum PAYMENT → paidAmount
                   ├─ sum REFUND  → refundedAmount
                   ├─ sum ORDER_ADJUSTMENT → (transient, not persisted to Order)
                   └─ effective = orderAmount + Σadj; compare netPaid vs effective for status
```

## Related Code Files

**Modify**
- `/Users/hido/trade-ops/lib/validation-schemas.ts` — extend `createOrderTransactionSchema`
- `/Users/hido/trade-ops/lib/order-status-calculator.ts` — use effective value
- `/Users/hido/trade-ops/lib/overpayment-guard.ts` — use effective value
- `/Users/hido/trade-ops/app/api/orders/[id]/report/route.ts` — add `adjustmentTotalOriginal` + recompute `balanceOriginal`
- `/Users/hido/trade-ops/app/api/orders/[id]/transactions/route.ts` — POST accepts new type
- `/Users/hido/trade-ops/app/api/orders/[id]/transactions/[txId]/route.ts` — PATCH accepts new type
- `/Users/hido/trade-ops/lib/messages.ts` — new VN error messages if needed

**No new files.**

## Implementation Steps

1. **`validation-schemas.ts`**
   - Add enum value `"ORDER_ADJUSTMENT"` to `type` in `createOrderTransactionSchema`.
   - Extract `amountOriginal` to `z.string()` (any decimal) + post-refine: positive for PAYMENT/REFUND types, any non-zero for ADJUSTMENT.
   - Add `paymentType` enum value `"ADJUSTMENT"`.
   - Refine: if `type === ORDER_ADJUSTMENT` then `bankFeeOriginal`, `bankFeeVnd`, `depositId` must be absent/empty; `paymentType` must be `ADJUSTMENT`.
   - Refine: non-ADJUSTMENT types continue to require amount > 0.
2. **`order-status-calculator.ts`**
   - Filter transactions into 3 buckets: payments (PAYMENT), refunds (REFUND), adjustments (ADJUSTMENT).
   - Compute `paidAmount`, `refundedAmount` as today.
   - Compute `adjTotal` = signed sum of adjustments.
   - `effectiveValue = orderAmount.plus(adjTotal)`.
   - Replace `orderAmount` with `effectiveValue` in all four status-branch comparisons.
   - Persist `paidAmount`, `refundedAmount` unchanged (adjustments NOT merged into paidAmount).
3. **`overpayment-guard.ts`**
   - Read adjustments alongside payments/refunds; pass `effectiveValue` as the ceiling.
4. **Order report route**
   - Add `adjustments = txs.filter(t => t.paymentType === "ADJUSTMENT")`.
   - Compute `adjustmentTotalOriginal` (signed, `toFixed(4)`).
   - `balanceOriginal = max(effective - paid + refunded, 0)` per spec formula `effectiveValue − paidAmount` where paidAmount is already net of refunds in UI model. Document this explicitly in code comment.
   - Include `adjustmentTotalOriginal` + `effectiveValueOriginal` in the returned `summary` object.
5. **Tx endpoints (POST/PATCH)**
   - No structural change — the schema now permits ADJUSTMENT; downstream `recalculateOrderStatus` picks it up.
   - Ensure audit log includes adjustment tx just like any other.
6. **Cache invalidation**
   - Confirm `orderReportKey(orderId)` invalidated on adjustment write — already handled by existing `invalidateTags([TAG.order(id)])` in tx endpoints.
7. Run `npx tsc --noEmit` — fix any consumer-side type breaks.

## Todo List

- [x] Extend `createOrderTransactionSchema` with ADJUSTMENT paths
- [x] Update `recalculateOrderStatus` to use effective value
- [x] Update `overpayment-guard` with effective ceiling
- [x] Expose `adjustmentTotalOriginal` + `effectiveValueOriginal` in order report
- [x] Correct `balanceOriginal` formula per spec
- [x] Manual test: create negative adjustment → status recomputes correctly
- [x] Manual test: fully-paid order + negative adjustment → still PAID
- [x] Manual test: positive adjustment makes PAID → PARTIAL_PAID

## Success Criteria

- Creating a `ORDER_ADJUSTMENT` tx with amount `-1000000` on a 50M order with 50M paid → status stays `PAID`, balance = 0.
- Adding `+5000000` adjustment on 50M order with 50M paid → status becomes `PARTIAL_PAID`, balance = 5M.
- Overpayment guard blocks payments that would exceed `effective − currentNetPaid`.
- `summary.adjustmentTotalOriginal` returns signed value (can be negative).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Legacy reports query `paidAmount` assuming max=orderAmount | M | M | Ship all summary/detail Excel in same release; UI balance formulas use report endpoint |
| Audit log loses signed-ness of adjustment | L | L | `decimalAny` preserves string; Decimal(18,4) supports negatives |
| paymentMethod=BANK on adjustment pollutes bank-fee report | L | L | Bank fee report filters `bankFeeOriginal IS NOT NULL` — adjustments have NULL fee, auto-excluded |
| UI double-counts adjustment as payment | M | H | Order detail summary card (phase 03) renders adjustments in dedicated row, NOT under "Đã thanh toán" |

## Security Considerations

- Adjustments are financially sensitive. RBAC for POST/PATCH tx already gated by role; reuse existing `checkAccess(roles, "POST", order.type)`.
- Audit log must capture signed amount (already stored as Decimal).

## Open Questions

<!-- Updated: Validation Session 1 - paymentType sentinel confirmed -->
- **Resolved (Validation Session 1):** `paymentType = "ADJUSTMENT"` sentinel locked in. No schema migration.

## Next Steps / Dependencies

- Unblocks: phase 03 (order UI)

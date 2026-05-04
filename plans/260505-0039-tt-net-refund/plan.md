---
title: "TT lần này = thực thu/chi − hoàn tiền (gộp refund vào periodPayment)"
description: "Đổi periodPayment thành net-of-refund; gỡ refund rows khỏi Thu khác/Chi khác để tránh double-count cashflow. Cho phép âm."
status: completed
priority: P2
effort: 1.5h
branch: main
tags: [reports, summary, refunds]
created: 2026-05-05
blockedBy: []
blocks: []
---

# TT lần này = Net of Refund

## Context
- Kết quả của plan `260505-0019-summary-debt-with-adjustments-and-refunds`: refund tách thành dòng riêng ở Thu khác/Chi khác, periodPayment chỉ trừ fee.
- User feedback: muốn cashflow gộp — `TT lần này = thực thu/chi − hoàn tiền (cùng kỳ)`. Bỏ dòng refund riêng.

## User Decisions
1. **Gộp refund vào TT lần này** (trừ bớt); **bỏ** dòng "Hoàn tiền" ở Thu khác/Chi khác.
2. **TT lần này có thể âm** khi refund > payment trong kỳ; UI hiển thị màu đỏ/dấu trừ.

## Formulas (Updated)

| Side | periodPayment (in period) |
|------|---------------------------|
| Customer (SALE) | `Σ(PAYMENT.amountOriginal − bankFeeOriginal) − Σ(REFUND.amountOriginal)` |
| Supplier (PURCHASE) | `Σ(PAYMENT.amountOriginal) − Σ(REFUND.amountOriginal)` |

VND parallel (Excel): `Σ(PAYMENT.amountVnd [− bankFeeVnd]) − Σ(REFUND.amountVnd)`.

`priorDebt`/`remainingDebt` formulas unchanged (still clamp at 0).

## Phases
| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [API + Excel net-refund](./phase-01-api-excel-net-refund.md) | completed | `app/api/reports/summary/route.ts`, `app/api/reports/summary/export/route.ts` |
| 2 | [UI negative display](./phase-02-ui-negative.md) | completed | `app/(dashboard)/reports/summary/page.tsx` |

## Success Criteria
- SALE order with payment 30, fee 2, refund 10 in period → `periodPayment = 30 − 2 − 10 = 18`.
- SALE order with payment 5, refund 20 in period → `periodPayment = −15` (UI red).
- Refund tx no longer surfaces as standalone row; `rowType="refund"` removed from union.
- Excel `paidThisTime` matches API.

## Rollback
- Per-file revert. No schema change.

## Open Questions
- VND for negative periodPayment in Excel: write as negative number? Spec sheet may want abs value. Keep negative (matches API). Defer to user QA.

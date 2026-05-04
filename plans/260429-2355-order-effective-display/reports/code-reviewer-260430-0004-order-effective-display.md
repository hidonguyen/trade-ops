# Code Review: Order Effective Display

## Scope
- 4 files, ~60 LOC net
- Focus: list/detail UI for effective value (base+adj) and net paid (paid-refund)

## Overall
Implementation is clean, mirrors backend semantics, uses Decimal at boundaries. Backend already exposes `effectiveValueOriginal`, `netPaidOriginal`, `adjustmentTotalOriginal` consistently with list endpoint's `adjustmentTotal`. No critical issues.

## Critical
None.

## High
None.

## Medium
1. **Excel export inconsistency** — `app/api/reports/sales-detail/export/route.ts:86` and `purchase-detail/export/route.ts:91` still emit raw `amountOriginal` plus separate `adjustmentTotal`/`paidAmount` columns. Plan claims unchanged, which matches reality, but this means **screen ≠ export**. Confirm with user; if exports represent base columns by design (consumer subtracts adjustments downstream) note it as expected. Otherwise add an effective-value column.
2. **Sort vs display divergence** (orders/page.tsx) — header sort key `amountOriginal`/`paidAmount` triggers server sort by raw fields while cells show effective/net. On rows with adjustments/refunds, ordering will look "wrong" to user. Acceptable for now (low data volume) but worth a tooltip-on-header or backend `effectiveValue` sort key later. Not blocking.

## Low
3. **Tooltip negative formatting** (orders/page.tsx render): `adj.gte(0) ? "+" : ""` + `toLocaleString("vi-VN")` — when adj < 0, `toLocaleString` already prefixes `-`, so result reads `Điều chỉnh: -300` (correct). When adj > 0, prefix `+` is added → `+300`. OK.
4. **Decimal precision** — `eff.toFixed(4)` then `parseFloat` inside `CurrencyAmount`: fine for VND/USD/CNY ranges; `toNumber()` only used for tooltip locale formatting (display path). No precision concern under 10^15.
5. **Negative net paid** — when `refundedAmount > paidAmount`, `CurrencyAmount` (components/shared/currency-amount.tsx:23) handles negatives with red color and leading `-`. Tooltip reads `Đã TT: 100 − Hoàn: 300` (subtle: it shows positive operands, user infers net=-200 from cell). Readable.
6. **Layout overflow risk** (order-info-card.tsx:106) — `(đã bao gồm điều chỉnh)` hint inline in same `<dd>` after `CurrencyAmount`. On narrow viewports the hint may wrap; since `dd` allows wrap and hint uses `text-xs`, acceptable. Consider `whitespace-nowrap` on the amount span if alignment matters, but YAGNI.
7. **Cache sync** — list `adjustmentTotal` (app/api/orders/route.ts:100) and detail `adjustmentTotalOriginal` (report/route.ts:64) are both computed live from `transactions` per request — no cache layer. They will stay in sync. Good.

## Positive
- Backend already exposes both effective and net fields → UI just consumes them; no client-side recomputation drift on detail page.
- Use of `Decimal` for sums; only converts to number at the display boundary.
- Hide-when-zero refund row reduces visual noise.
- Comments explain intent (`Headline value = base + adjustment`).

## Recommended Actions
1. Confirm with user that export keeping raw `amountOriginal` is intentional (Medium #1).
2. Optional follow-up: align table sort to effective value if user reports confusion (Medium #2).

## Metrics
- Type Coverage: types match backend schema (page.tsx:35-39 declares the new fields)
- Pre-existing lint warnings unrelated — skipped per instruction

## Unresolved Questions
- Should sales/purchase-detail Excel exports adopt effective value columns, or keep raw + adjustment split for downstream BI?
- Should the list-page column header indicate "(effective)" so sort behavior is less surprising?

**Status:** DONE
**Summary:** UI changes are correct and consistent with backend. Two medium items (export divergence, sort-vs-display) are scope/UX questions, not bugs.

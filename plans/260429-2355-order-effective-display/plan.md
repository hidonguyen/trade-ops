---
title: Display effective order value (+ adjustment) and net paid (− refund)
description: Update list page columns and detail page headline values to show order amount + adjustment as "Giá trị đơn hàng" and paid − refund as "Đã thanh toán"; preserve breakdown rows on detail and add tooltips with breakdown on list when adj/refund ≠ 0
status: completed
completed: 2026-04-30
priority: P3
effort: ~45m
branch: main
tags: [orders, ui, display]
created: 2026-04-29
blockedBy: []
blocks: []
---

# Plan: Effective order value + net-paid display

## Context

Today the list page and `OrderInfoCard` show **gross** order amount and **gross** paid amount. They ignore order adjustments (signed `ORDER_ADJUSTMENT` transactions) and refunds. `FinancialSummaryCard` already shows the breakdown but headline rows still show gross figures.

User wants headline numbers to reflect:
- **Giá trị đơn hàng** = `amountOriginal + adjustmentTotal` (effective value)
- **Đã thanh toán** = `paidAmount − refundedAmount` (net paid)

Apply both on list page and order detail page.

## Data already available

- **List API** (`app/api/orders/route.ts:93-100`): returns `adjustmentTotal` per order. List page row has `amountOriginal`, `paidAmount`, `refundedAmount`, `adjustmentTotal`.
- **Detail report API** (`app/api/orders/[id]/report/route.ts`): returns `summary.effectiveValueOriginal`, `summary.adjustmentTotalOriginal`, `summary.netPaidOriginal`, `summary.totalPaidOriginal`, `summary.totalRefundedOriginal`. Detail page already has these in scope.

→ **No API or schema changes.** Pure frontend display update.

## UX decisions (confirmed with user)

1. **List page**: show single combined number per column. When `adjustmentTotal !== 0` or `refundedAmount > 0`, render the cell with a native `title=` tooltip showing the breakdown ("Giá trị gốc: X + Điều chỉnh: Y" / "Đã TT: X − Hoàn: Y").
2. **Detail page** (`FinancialSummaryCard`): headline rows show effective/net values; keep the existing breakdown rows ("Điều chỉnh giá trị đơn hàng", "Đã hoàn tiền") visible when non-zero so the math is transparent.
3. **Detail page** (`OrderInfoCard`): rename the "Số tiền" field to "Giá trị đơn hàng" and show the effective value. Pass `adjustmentTotalOriginal` from the parent page.

## Scope

| File | Change |
|---|---|
| `app/(dashboard)/orders/page.tsx` | "Giá trị đơn hàng" column → render `amountOriginal + adjustmentTotal`; "Đã thanh toán" column → render `paidAmount − refundedAmount`; both with `title` tooltip when adj/refund ≠ 0 |
| `app/(dashboard)/orders/[id]/order-info-card.tsx` | Accept `adjustmentTotal?: string` prop; rename "Số tiền" → "Giá trị đơn hàng"; show effective value; update VND-equivalent calculation to use effective |
| `app/(dashboard)/orders/[id]/financial-summary-card.tsx` | "Giá trị đơn hàng" row → use `effectiveValueOriginal` instead of `orderAmountOriginal`; "Đã thanh toán" row → use `netPaidOriginal` instead of `totalPaidOriginal`; keep "Điều chỉnh" + "Đã hoàn tiền" breakdown rows (already conditional on non-zero) |
| `app/(dashboard)/orders/[id]/page.tsx` | Pass `report.summary.adjustmentTotalOriginal` to `OrderInfoCard` |

## Implementation outline

### 1. List page (`orders/page.tsx`)

Replace the two column renders (around lines 197–219):

```tsx
{
  key: "amountOriginal",
  label: "Giá trị đơn hàng",
  align: "right",
  render: (_, row) => {
    const base = new Decimal(row.amountOriginal ?? "0");
    const adj = new Decimal(row.adjustmentTotal ?? "0");
    const eff = base.plus(adj);
    const tooltip = !adj.isZero()
      ? `Gốc: ${base.toFixed(0)} | Điều chỉnh: ${adj.gte(0) ? "+" : ""}${adj.toFixed(0)}`
      : undefined;
    return (
      <span title={tooltip}>
        <CurrencyAmount
          amount={eff.toFixed(4)}
          currencyCode={row.currency?.code ?? "VND"}
          currencySymbol={row.currency?.symbol ?? "₫"}
        />
      </span>
    );
  },
},
{
  key: "paidAmount",
  label: "Đã thanh toán",
  align: "right",
  render: (_, row) => {
    const paid = new Decimal(row.paidAmount ?? "0");
    const refunded = new Decimal(row.refundedAmount ?? "0");
    const net = paid.minus(refunded);
    const tooltip = !refunded.isZero()
      ? `Đã TT: ${paid.toFixed(0)} − Hoàn: ${refunded.toFixed(0)}`
      : undefined;
    return (
      <span title={tooltip}>
        <CurrencyAmount
          amount={net.toFixed(4)}
          currencyCode={row.currency?.code ?? "VND"}
          currencySymbol={row.currency?.symbol ?? "₫"}
        />
      </span>
    );
  },
},
```

Note: format inside the tooltip uses VN locale separators? Keep simple — `toFixed(0)` rounds; for currency nicer formatting use `Intl.NumberFormat("vi-VN")` if needed (low priority).

### 2. OrderInfoCard

```tsx
interface OrderInfoCardProps {
  order: Order;
  adjustmentTotal?: string; // signed
}

// in render:
const adjAmount = new Decimal(adjustmentTotal ?? "0");
const baseAmount = new Decimal(order.amountOriginal ?? "0");
const effectiveAmount = baseAmount.plus(adjAmount).toFixed(4);

// VND equivalent uses effectiveAmount
const vndEquivalent = isNonVnd && rate > 0
  ? (parseFloat(effectiveAmount) * rate)
      .toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " ₫"
  : null;

// "Số tiền" block → label="Giá trị đơn hàng", amount=effectiveAmount
```

Show a small note under the value when adj ≠ 0: `<span className="text-xs text-slate-500">Đã bao gồm điều chỉnh</span>`.

### 3. FinancialSummaryCard

```tsx
// "Giá trị đơn hàng" row uses effectiveValueOriginal (fallback to orderAmountOriginal)
<SummaryRow
  label="Giá trị đơn hàng"
  value={summary.effectiveValueOriginal ?? summary.orderAmountOriginal}
  ...
/>
// keep adjustment row as breakdown explanation (already conditional on adj ≠ 0)

// "Đã thanh toán" row uses netPaidOriginal
<SummaryRow
  label="Đã thanh toán"
  value={summary.netPaidOriginal}
  highlight="positive"
  ...
/>
// keep "Đã hoàn tiền" row as breakdown when refund > 0 (already conditional)
```

(Refund row currently always rendered — wrap it in `{parseFloat(summary.totalRefundedOriginal) > 0 && (...)}` to hide when zero, since the headline already nets it out.)

### 4. Detail page

In the JSX where `<OrderInfoCard order={...} />` is rendered, pass `adjustmentTotal={report.summary.adjustmentTotalOriginal}`.

## Edge cases

| Case | Behavior |
|---|---|
| `adjustmentTotal === 0` | Show base amount; no tooltip; no "(đã bao gồm điều chỉnh)" hint |
| Negative adjustment exceeds order amount | Effective < 0; render as-is. Currency component handles negative. |
| `refundedAmount > paidAmount` (net negative) | Show negative net paid value. Pre-existing scenarios; balance guard already handles it elsewhere. |
| Decimal precision | All math uses `Decimal.js`, not `Number`. Final `toFixed(4)` for display. |
| Zero exchange rate (VND order) | VND equivalent already gated by `isNonVnd`; no change. |
| Sort by "Giá trị đơn hàng" column | Currently sorts by `amountOriginal` server-side. After change, the displayed value is effective — sort still by raw `amountOriginal`. **Acceptable mismatch** (rare); document or skip. |

## Acceptance criteria

- [ ] List "Giá trị đơn hàng" column shows `amountOriginal + adjustmentTotal`; tooltip when adjustment ≠ 0 shows breakdown.
- [ ] List "Đã thanh toán" column shows `paidAmount − refundedAmount`; tooltip when refunded > 0 shows breakdown.
- [ ] OrderInfoCard "Số tiền" renamed to "Giá trị đơn hàng" and shows effective value; VND equivalent reflects effective.
- [ ] FinancialSummaryCard "Giá trị đơn hàng" row uses `effectiveValueOriginal`; "Đã thanh toán" row uses `netPaidOriginal`.
- [ ] Breakdown rows ("Điều chỉnh", "Đã hoàn tiền") remain visible only when non-zero.
- [ ] `npm run type-check` passes.
- [ ] Manual: order with adjustment +500K and refund 200K → list shows effective + net, detail shows breakdown.
- [ ] Manual: order with no adjustment, no refund → values unchanged from current display (no tooltips).

## Risks

- **Column sort confusion**: server sorts by raw `amountOriginal`; client displays effective. Acceptable; out of scope to add server-side effective-sort (would require subquery or denormalized column).
- **Existing reports/exports**: do NOT change. Excel/summary exports keep their own logic. Verify by grepping `summaryExport` and confirming no shared component.
- **Status badge ("Còn phải TT") column**: unchanged — already uses effective math (line 226–231).

## Phases

Single phase — implement directly per outline.

## Todo

- [x] Update list page two column renders + tooltips (VN-locale formatted)
- [x] Add `adjustmentTotal` prop to `OrderInfoCard`, rename label, compute effective + "(đã bao gồm điều chỉnh)" hint
- [x] Update `FinancialSummaryCard` headline rows + hide refund row when zero
- [x] Pass `adjustmentTotalOriginal` from detail page to `OrderInfoCard`
- [x] Type-check
- [ ] Manual smoke (2 scenarios — pending user verification)

## Open questions

1. Should the column sort key follow display value (effective) or raw `amountOriginal`? (Plan keeps raw — server-side sort unchanged; flag for follow-up if users complain.)
2. Tooltip number formatting — `toFixed(0)` is plain; should it use `Intl.NumberFormat("vi-VN")` for thousands separators? (Low priority; nice-to-have.)

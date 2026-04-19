# Summary Report Redesign — Detailed Thu/Chi with Debt Tracking

**Created:** 2026-04-20
**Status:** completed
**Priority:** high
**Complexity:** high (new API, full page rewrite)

## Summary

Redesign `/reports/summary` from aggregated currency totals to detailed order-level view with 4 tabs showing individual order/transaction rows and debt tracking (nợ cũ → thanh toán → nợ còn lại).

## Current State
- API returns 4 currency-aggregated arrays (totalSales, totalPurchases, totalReceivable, totalPayable)
- Page shows simple table: Tiền tệ | Số tiền

## New Design

### 4 Tabs

| Tab | Data Source | Description |
|-----|-----------|-------------|
| **Thu từ khách hàng** | SALE orders with PAYMENT transactions in period | Đơn bán có phát sinh thanh toán |
| **Thu khác** | Standalone RECEIPT transactions in period | Phiếu thu không gắn đơn |
| **Chi trả nhà cung cấp** | PURCHASE orders with PAYMENT transactions in period | Đơn mua có phát sinh thanh toán |
| **Chi khác** | Standalone PAYMENT transactions in period | Phiếu chi không gắn đơn |

### Columns — Order-linked tabs (Thu từ KH / Chi trả NCC)

| # | Column | Computation |
|---|--------|-------------|
| 1 | STT | Row index |
| 2 | Khách hàng/NCC | order.party.name |
| 3 | Mã đơn hàng | order.orderNumber |
| 4 | Ngày đơn hàng | order.orderDate |
| 5 | Nợ cũ | balance as of dateFrom (orderAmount - sum of PAYMENT txs before dateFrom) |
| 6 | Thanh toán lần này | sum of PAYMENT txs within [dateFrom, dateTo] |
| 7 | Nợ còn lại | balance as of dateTo (orderAmount - sum of all PAYMENT txs up to dateTo) |
| 8 | Ghi chú | order.notes |

### Columns — Standalone tabs (Thu khác / Chi khác)

| # | Column | Source |
|---|--------|--------|
| 1 | STT | Row index |
| 2 | Ngày | transactionDate |
| 3 | Số tiền | amountOriginal |
| 4 | Tiền tệ | currency.code |
| 5 | Phương thức | paymentMethod |
| 6 | Tham chiếu | bankReference |
| 7 | Ghi chú | notes |

### "Nợ cũ" computation
For each order in the report:
```
totalPaidBeforePeriod = sum of PAYMENT txs where transactionDate < dateFrom
nợ_cũ = max(orderAmount - totalPaidBeforePeriod, 0)
```

### "Nợ còn lại" computation
```
totalPaidUpToEnd = sum of PAYMENT txs where transactionDate <= dateTo
nợ_còn_lại = max(orderAmount - totalPaidUpToEnd, 0)
```

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [API redesign](./phase-01-api-redesign.md) | pending | Summary API route |
| 2 | [Page redesign](./phase-02-page-redesign.md) | pending | Summary page |

## Key Decisions

- API returns 4 arrays with different shapes (order rows vs transaction rows)
- Debt computation happens server-side for accuracy
- "Nợ cũ" uses all transactions BEFORE dateFrom, "nợ còn lại" uses all up to dateTo
- Only orders that have at least 1 PAYMENT tx in the period appear in the list
- Standalone tabs are simpler — just transaction list filtered by date and type

## Dependencies
- None

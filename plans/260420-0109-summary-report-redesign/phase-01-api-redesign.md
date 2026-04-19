# Phase 01 — Summary Report API Redesign

## Overview
- **Priority:** high
- **Status:** pending
- Rewrite summary API to return per-order rows with debt tracking

## Related Code Files
- `app/api/reports/summary/route.ts` — full rewrite

## API Response Shape

```ts
interface SummaryResponse {
  customerReceipts: OrderDebtRow[];      // Thu từ khách hàng
  otherReceipts: StandaloneRow[];        // Thu khác
  supplierPayments: OrderDebtRow[];      // Chi trả NCC
  otherPayments: StandaloneRow[];        // Chi khác
}

interface OrderDebtRow {
  orderId: string;
  partyName: string;
  orderNumber: string;
  orderDate: string;
  currencyCode: string;
  currencySymbol: string;
  priorDebt: string;         // nợ cũ
  periodPayment: string;     // thanh toán lần này
  remainingDebt: string;     // nợ còn lại
  notes: string | null;
}

interface StandaloneRow {
  id: string;
  transactionDate: string;
  amountOriginal: string;
  currencyCode: string;
  currencySymbol: string;
  paymentMethod: string;
  bankReference: string | null;
  notes: string | null;
}
```

## Implementation

1. Query SALE orders with transactions that have paymentType=PAYMENT in period
2. For each order, compute:
   - paidBeforePeriod = sum txs where date < dateFrom
   - paidInPeriod = sum txs where dateFrom <= date <= dateTo
   - priorDebt = max(orderAmount - paidBeforePeriod, 0)
   - remainingDebt = max(orderAmount - paidBeforePeriod - paidInPeriod, 0)
3. Same for PURCHASE orders
4. Query standalone RECEIPT txs in period (orderId=null, type=RECEIPT)
5. Query standalone PAYMENT txs in period (orderId=null, type=PAYMENT)

## Todo List
- [ ] Rewrite summary API
- [ ] Verify compile

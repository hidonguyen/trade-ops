# Phase 7: Orders + Transactions + Cashflow UI

## Context Links
- [Design Guidelines](../../docs/design-guidelines.md) -- data tables, status badges, form inputs
- [Wireframe: Orders List](../../docs/wireframes/02-orders-list.html)
- [Wireframe: Order Detail](../../docs/wireframes/03-order-detail.html)
- Phase 3 (APIs consumed by this phase)
- Phase 5 (shared components used)

## Overview
- **Priority:** P2
- **Status:** Planned
- **Effort:** 4h
- **Blocked by:** Phase 3 (APIs), Phase 5 (shared components)
- **Blocks:** None
- **Parallel with:** Phases 6, 8
- **Description:** Build UI pages for order management (list, detail, create, edit), transaction recording (order-linked and standalone), and cashflow report page.

## Key Insights
- Orders list shows both SALE and PURCHASE with type filter tab
- Order detail is the most complex page: info + transaction list + add payment form
- Transaction form handles: paymentMethod (BANK/DEPOSIT), paymentType (PAYMENT/REFUND), multi-currency
- When paymentMethod=DEPOSIT, show deposit selector dropdown with remaining balances
- FE computes amountVnd = amountOriginal * exchangeRate (Decimal.js) before sending to API
- Cashflow page: date range filter + currency filter + summary cards + transaction table
- Currency display: single column with inline symbol, no separate currency column

## File Ownership (Exclusive)

```
app/(dashboard)/orders/page.tsx
app/(dashboard)/orders/[id]/page.tsx
app/(dashboard)/orders/[id]/edit/page.tsx
app/(dashboard)/orders/new/page.tsx
app/(dashboard)/transactions/page.tsx
app/(dashboard)/transactions/new/page.tsx
app/(dashboard)/cashflow/page.tsx
components/order-form.tsx
components/payment-form.tsx
components/transaction-form.tsx
```

## Implementation Steps

### 1. Order Form Component (0.5h)
1. `components/order-form.tsx`
   - Props: { initialData?, onSubmit, mode: 'create' | 'edit' }
   - Fields: type (SALE/PURCHASE), partyId (select, filtered by type), businessUnitId, amountOriginal (Decimal input), currencyId, orderDate, notes
   - Client-side zod validation
   - Party dropdown filtered: SALE -> customers, PURCHASE -> suppliers

### 2. Order List Page (0.5h)
1. `app/(dashboard)/orders/page.tsx`
   - Tab filter: All / Sales / Purchases (or type dropdown)
   - FilterBar: status, businessUnit, party search, date range
   - DataTable columns: date, party name, type badge, amount (CurrencyAmount), status (StatusBadge), actions
   - Pagination
   - "Tao don" (Create order) button -> /orders/new
   - Row click -> /orders/[id]

### 3. Order Create/Edit Pages (0.5h)
1. `app/(dashboard)/orders/new/page.tsx`
   - Renders OrderForm in create mode
   - POST to /api/orders, redirect to detail
2. `app/(dashboard)/orders/[id]/edit/page.tsx`
   - Fetch order, render OrderForm in edit mode
   - PATCH to /api/orders/[id]

### 4. Payment Form Component (0.5h)
1. `components/payment-form.tsx`
   - Used inside order detail page for adding payments
   - Fields: paymentType (PAYMENT/REFUND), paymentMethod (BANK/DEPOSIT), amountOriginal, currencyId (locked to order currency), exchangeRate, amountVnd (auto-computed), bankReference, transactionDate, notes
   - If DEPOSIT method: depositId select dropdown showing party deposits with remaining balances
   - FE computation: `amountVnd = Decimal(amountOriginal).times(exchangeRate).toDecimalPlaces(4)`
   - Sends both amountOriginal and amountVnd to API

### 5. Order Detail Page (1h)
1. `app/(dashboard)/orders/[id]/page.tsx`
   - Order info card: party, type, date, amount, status badge
   - Financial summary: amountOriginal, paidAmount, refundedAmount, remaining
   - Transaction list (DataTable): date, type, method, amount, reference
   - "Them thanh toan" (Add payment) button opens PaymentForm dialog
   - Edit/Delete buttons with RBAC
   - After payment submission: refresh order data (status recalculated server-side)

### 6. Standalone Transaction Pages (0.5h)
1. `components/transaction-form.tsx`
   - Props: { mode: 'create' | 'edit', initialData? }
   - Fields: type (RECEIPT/PAYMENT), businessUnitId, amountOriginal, currencyId, exchangeRate, amountVnd (auto-computed), paymentMethod, bankReference, transactionDate, notes
   - If DEPOSIT: depositId selector
2. `app/(dashboard)/transactions/page.tsx`
   - FilterBar: type (RECEIPT/PAYMENT), businessUnit, date range
   - DataTable: date, type, amount, method, reference
   - "Them giao dich" button -> /transactions/new
3. `app/(dashboard)/transactions/new/page.tsx`
   - Renders TransactionForm, POST to /api/transactions

### 7. Cashflow Page (0.5h)
1. `app/(dashboard)/cashflow/page.tsx`
   - FilterBar: businessUnitId, dateFrom, dateTo, currencyId
   - Summary cards: total receipts, total payments, net cashflow (per currency)
   - DataTable: all transactions in period (date, type, party, amount, method)
   - Export button: downloads Excel via /api/cashflow-report?format=xlsx

## Todo Checklist

- [ ] components/order-form.tsx (create/edit)
- [ ] Orders list page with type tabs + filters + pagination
- [ ] Order create page
- [ ] Order edit page
- [ ] components/payment-form.tsx (with deposit selector + amountVnd computation)
- [ ] Order detail page (info + financial summary + transaction list + add payment)
- [ ] components/transaction-form.tsx (standalone receipt/payment)
- [ ] Transactions list page with filters
- [ ] Transaction create page
- [ ] Cashflow page (filters + summary cards + table + export)
- [ ] Decimal.js amountVnd computation on FE
- [ ] CurrencyAmount display (single column, inline symbol)
- [ ] RBAC checks on all pages

## Success Criteria
1. Orders list: filter by type/status/BU, paginate, sort
2. Order creation: validates, creates, redirects to detail with UNPAID status
3. Order detail: shows transactions, allows adding payment
4. Payment with DEPOSIT method: deposit selector shows remaining balances, deduction works
5. amountVnd auto-computed from amountOriginal * exchangeRate on form change
6. Order status updates after payment (page refreshes to show new status)
7. Standalone transactions: create RECEIPT/PAYMENT without orderId
8. Cashflow page: correct totals per currency, Excel export works

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Order detail page complexity (>200 LOC) | High | Medium | Split into sub-components: OrderInfoCard, OrderTransactions, PaymentDialog |
| Decimal.js FE computation mismatch | Medium | High | Use same Decimal.js on FE and BE; validate amountVnd server-side within tolerance |
| Deposit selector stale data | Medium | Medium | Refetch deposits on PaymentForm open |
| Currency display inconsistency | Low | Medium | Single CurrencyAmount component used everywhere |

## Security Considerations
- RBAC: SALE pages -> SALE dimension, PURCHASE -> PURCHASE dimension
- Payment form validates deposit belongs to same party
- amountVnd sent from FE is stored as-is; BE does not recompute (design decision)
- Client-side Decimal.js prevents floating-point errors in UI calculations

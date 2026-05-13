# Phase 06 — Copy Feature

**Effort:** 6h | **Depends on:** Phase 01 (BU mapping cho copy đơn)

## Approach
KISS: client-side prefill via sessionStorage. Không tạo endpoint mới.

### Order copy
- Button **Copy** trên order list row + order detail header.
- Click → `sessionStorage.setItem("order:prefill", JSON.stringify({ partyId, currencyId, amountOriginal, exchangeRate, businessUnitId, expenseTypeId, notes, type }))`.
- Navigate đến `/orders/new?type=...&from=copy`.
- Order new page đọc sessionStorage khi mount → prefill form. Clear sau khi load.
- KHÔNG copy: `orderNumber`, `orderDate`, `paymentDueDate`, `id`, `status`, `paidAmount`, `refundedAmount`, transactions.

### Transaction copy
- Button **Copy** trên transaction list (cả `/transactions` và bên trong order detail).
- Cùng pattern: prefill `paymentMethod`, `amountOriginal`, `currencyId`, `contactId`, `notes`, `bankFeeOriginal/Vnd`, `expenseTypeId`, party (nếu standalone).
- KHÔNG copy: `id`, `transactionDate`, `bankReference`, `orderId` (trừ khi cùng đơn — flow nội bộ order detail).
- Navigate đến `/transactions/new` hoặc mở payment dialog với prefill.

## RBAC
- Hiện button khi user có quyền CREATE module tương ứng (SALE/PURCHASE/RECEIPT/PAYMENT).

## Todo
- [ ] Helper hook `usePrefill(key)` đọc + clear sessionStorage
- [ ] Copy button on order list/detail
- [ ] Order new page consumes prefill
- [ ] Copy button on transaction list (standalone + order-linked)
- [ ] Payment form / standalone TX form consume prefill
- [ ] Smoke test: copy đơn SALE → form điền sẵn, đổi số đơn → save thành công

## Success
Copy đơn bất kỳ → form mới mở với 90% data, user chỉ điền số đơn + ngày.
Copy phiếu TX → form mới mở với data, user chỉ điền ngày + bank ref.

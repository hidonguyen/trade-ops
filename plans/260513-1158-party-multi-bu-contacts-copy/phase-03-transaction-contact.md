# Phase 04 — Transaction Contact Selector

**Effort:** 6h | **Depends on:** Phase 01, 03

## API
- `POST /api/transactions` + `PATCH /api/transactions/[id]` — accept `contactId?: string | null`.
- `GET` includes `contact: { select: { id, name, phone } }`.
- Same for order-linked TX endpoints (`/api/orders/[id]/transactions/...`).
- Validate FK exists + isActive when provided.

## UI
- **Payment form** (`components/payment-form.tsx`): thêm field "Người nộp/nhận tiền" — autocomplete combobox dùng `/api/contacts?search=`.
  - Optional. Cho phép clear.
  - Hiện sđt bên cạnh tên trong dropdown.
- **Standalone receipt/payment form** (`/transactions/new`): cùng field.
- **Transaction edit form**: prefill contact.
- Hiển thị contact name trong transaction list/table khi có.

## Use cases
- RECEIPT/PAYMENT (standalone thu chi) — chính.
- Order payment/refund — vẫn cho phép gán contact (ai trả tiền cho đơn này).

## Todo
- [ ] API accept + validate contactId
- [ ] Payment form contact combobox
- [ ] Standalone tx form contact field
- [ ] List columns hiện contact name
- [ ] Audit diff bao gồm contactId

## Success
Tạo phiếu thu, chọn contact "Nguyễn A" → lưu → xem lại detail thấy contact name.

# Phase 03 — Contact CRUD

**Effort:** 8h | **Depends on:** Phase 01

## API: `app/api/contacts/`
- `GET /api/contacts` — list with search by name/phone, isActive filter, pagination.
- `POST /api/contacts` — create.
- `GET /api/contacts/[id]` — detail (incl. recent transactions count).
- `PATCH /api/contacts/[id]` — update.
- `DELETE /api/contacts/[id]` — block 409 if any Transaction references it. (Admin only.)

## RBAC
- Read: anyone authenticated.
- Write/Delete: ADMIN.
- Sau này có thể mở cho ACCOUNTANT_CASHFLOW — out of scope.

## Validation (Zod)
- `name` required, max 200.
- `phone` optional, regex VN số (10–11 chữ số).
- `email` optional, email format.
- `taxId` optional, max 30.
- `address` optional, max 500.
- `notes` optional, max 1000.

## UI: `app/(dashboard)/settings/contacts/`
- List page (DataTable + search bar + active filter + thêm/sửa/xóa).
- Inline dialog form (giống `/settings/expense-types/`).
- Add menu entry "Người nộp/nhận" trong settings.

## Audit
- Log CREATE/UPDATE/DELETE Contact với full snapshot.

## Todo
- [ ] 5 API endpoints
- [ ] Zod schema
- [ ] Settings list page + dialog form
- [ ] Settings menu entry
- [ ] Audit logging
- [ ] Smoke: create → use in TX → delete blocked

## Success
Có thể tạo/sửa/xóa contact từ settings; danh sách có thể search theo tên/sđt; xóa contact đang dùng → 409.

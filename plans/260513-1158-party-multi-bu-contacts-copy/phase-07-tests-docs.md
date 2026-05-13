# Phase 07 — Tests + Docs

**Effort:** 3h

## Tests
- Unit: party multi-BU filter helper.
- Unit: contact validation Zod schema.
- Unit: prefill hook (sessionStorage roundtrip).
- Manual smoke: end-to-end checklist below.

## Manual smoke checklist
- [ ] Tạo party "Chung" → có ở dropdown TK + NT.
- [ ] Tạo party "TK only" → KHÔNG có ở NT.
- [ ] Đổi BU của party hiện có → reflect ngay.
- [ ] Tạo contact "Nguyễn A" với MST cá nhân → search được theo tên + sđt.
- [ ] Xóa contact đang có TX → 409.
- [ ] Tạo phiếu thu, chọn contact → lưu, xem report cashflow thấy cột người nộp.
- [ ] Excel export cashflow có cột người nộp.
- [ ] Copy đơn → form mới prefilled, đổi số đơn → lưu OK.
- [ ] Copy phiếu thu → form mới prefilled.
- [ ] Audit log có entry cho contact CREATE/UPDATE/DELETE + party BU change.

## Docs
- `docs/system-architecture.md` — section Party: M2M BU; section Contact: new model.
- `docs/code-standards.md` — note: party query phải join M2M; transaction include contact khi cần hiển thị.
- README — feature list cập nhật.

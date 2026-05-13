# Phase 02 — Party Multi-BU

**Effort:** 10h | **Depends on:** Phase 01

## API
- `POST/PATCH /api/parties` — body thêm `businessUnitIds: string[]` (rỗng = chung tất cả BU active hiện có).
- Atomic: replace M2M rows in transaction.
- `GET /api/parties` — filter "party của BU X" = `where: { businessUnits: { some: { businessUnitId: X } } }`.
- All callers (orders/transactions/deposits party dropdown) chuyển sang dùng filter qua M2M.

## Filter logic (KISS)
- Nếu `businessUnitIds.length === 0` khi tạo → coi như "chung". UI thực sự lưu = INSERT row cho **mọi** BU active để query đơn giản hóa (KHÔNG dùng null sentinel).
- Khi BU mới được tạo trong tương lai → cron/script (ngoài scope) hoặc admin nhấn "đồng bộ chung" trong settings BU. Tạm thời chấp nhận: party shared chỉ thấy ở các BU đã tồn tại lúc tạo party.

## UI — Party form
- Thêm field "Đơn vị sử dụng":
  - Checkbox "Chung tất cả BU" (mặc định cho party mới)
  - Hoặc multi-select từng BU
- Hiển thị badge BU trong party list.

## UI — Party list
- BU filter (existing) → vẫn dùng, nhưng query sang M2M.

## Todo
- [ ] PUT/POST endpoint atomic upsert M2M
- [ ] Update GET filter to use M2M join
- [ ] Update all party dropdown filters
- [ ] Party form: BU multi-select + "chung" toggle
- [ ] Party list: BU badges
- [ ] Migrate audit log diff để ghi `businessUnitIds`

## Success
- Tạo party mới với "Chung" → xuất hiện ở dropdown order của TK và NT.
- Tạo party với chỉ TK → KHÔNG xuất hiện ở NT order form.
- Đổi BU của party hiện có → reflect ngay trong dropdown.

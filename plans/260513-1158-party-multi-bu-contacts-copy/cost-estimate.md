# Cost Estimate — Party Multi-BU + Contacts + Copy

> Báo giá khớp với báo giá tổng hợp (`plans/reports/quote-260513-1234-rbac-party-contacts-copy-combined.md`).
> Đơn giá: **120.000 ₫ / giờ** (Senior dev).
> Thứ tự thực hiện chốt: **A → C → D → E → F → B**.

## Phạm vi
Plan này phụ trách **C, D, E, F, B**. **A** (RBAC per BU) thuộc plan riêng `260507-1039-rbac-per-business-unit/` — phải xong trước, chi phí tách riêng.

## Tổng công sức theo thứ tự thực hiện

| # | Group | Phase | Giờ | Chi phí |
|---|---|---|---:|---:|
| 1 | C | Schema Contact + ContactBusinessUnit + Transaction.contactId (phase-01) | 3 | 360.000 ₫ |
| 2 | C | Contact CRUD + multi-BU + audit (phase-02) | 11 | 1.320.000 ₫ |
| 3 | D | Transaction contact selector (phase-03) | 7.5 | 900.000 ₫ |
| 4 | E | Reports + Excel exports cột Người Nộp/Nhận (phase-04) | 10 | 1.200.000 ₫ |
| 5 | F | Copy đơn + Copy phiếu TX (phase-05) | 7.5 | 900.000 ₫ |
| 6 | B | Party multi-BU API + UI + sweep dropdown (phase-06) | 15 | 1.800.000 ₫ |
| 7 | — | Tests + docs (phase-07) | 3 | 360.000 ₫ |
| | | **Tiểu tổng (B–F + tests)** | **57** | **6.840.000 ₫** |

## Tổng kết

| Khoản | Giờ | Chi phí |
|---|---:|---:|
| A — RBAC per BU (plan riêng) | 34 | 4.140.000 ₫ |
| Plan này (C + D + E + F + B + tests) | 57 | 6.840.000 ₫ |
| **TỔNG GỘP** | **91** | **10.980.000 ₫** |

> **Báo giá làm tròn (cho khách): 10.000.000 ₫** (mười triệu đồng) — đã bao gồm thiết kế, lập trình, kiểm thử, tài liệu, triển khai và 1 tuần bảo hành lỗi.

## Tiến độ dự kiến (~3 tuần, 1 senior full-time)
- **Tuần 1:** A (RBAC per BU) — nền móng.
- **Tuần 2:** C (schema + CRUD + multi-BU) → D (TX contact) → E (báo cáo).
- **Tuần 3:** F (copy) → B (party multi-BU + sweep dropdown) → nghiệm thu.

## Giả định
- Số BU hiện tại: 2 (TK, NT). Nếu tăng > 5, UI multi-select cần rework (+2h cho mỗi nhóm C, B).
- Số contact dự kiến < 1.000 → Postgres LIKE đủ, không cần full-text.
- Schema migration chạy trên DB ≤ 50.000 party — backfill nhẹ. DB lớn cần batched script (+2h).
- Báo cáo cần update ≤ 6 file Excel service. Phát sinh thêm tính theo giờ.
- Copy không bao gồm copy transactions của 1 đơn (chỉ copy form đơn rỗng).
- Giai đoạn từ C bắt đầu đến B xong, Party vẫn dùng hành vi cross-BU cũ — đã thông báo cho khách.

## Hành vi chuyển tiếp (transitional)
- Sau A: hệ thống đã có BU switcher + RBAC enforcement đầy đủ.
- Sau C → trước B: Contact multi-BU hoạt động; Party còn dùng `businessUnitId` đơn (hành vi cũ).
- Sau B: Party multi-BU + sweep dropdown ở mọi form (order/transaction/deposit) hoàn tất.

## Add-on (tùy chọn)
- **+5.000.000 ₫:** import contact từ Excel (CSV import + mapping UI).
- **+6.000.000 ₫:** copy bulk (chọn nhiều đơn cùng lúc) + lịch sử "Copied from #...".
- **+2.000.000 ₫:** copy transactions kèm theo đơn khi copy đơn.

## Ngoài phạm vi
- Merge / dedupe party trùng giữa BU (di sản pre-multi-BU).
- API public để bên thứ 3 đồng bộ contact.
- Soft-delete contact (chỉ active/inactive).
- Copy bulk.

## Điều khoản thanh toán đề xuất
- **40%** khi ký hợp đồng / start.
- **40%** khi nghiệm thu A + C + D + E trên staging (cuối tuần 2).
- **20%** sau 7 ngày bảo hành production.

## Phụ thuộc
- **Bắt buộc:** plan `260507-1039-rbac-per-business-unit` phải xong trước (Group A). Không có A, multi-BU filter trong C/B mất ý nghĩa.

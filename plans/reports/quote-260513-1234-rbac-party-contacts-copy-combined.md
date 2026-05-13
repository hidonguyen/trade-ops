# BÁO GIÁ

**Khách hàng:** TRANG KHANH
**Ngày:** 13/05/2026
**Phạm vi:** Trade Ops — phần mềm quản lý thu chi xuất nhập khẩu
**Đơn giá:** **120.000 ₫ / giờ** (Senior dev)

---

## 1. Tổng quan các tính năng

> **Thứ tự thực hiện chốt:** A → C → D → E → F → B.

| Nhóm | Tính năng | Mô tả ngắn |
|---|---|---|
| **A** | Phân quyền theo Đơn vị Kinh doanh | User có role khác nhau trên từng BU. ADMIN giữ global. |
| **C** | Người Nộp/Nhận (Contact) — quản lý + chia sẻ giữa BU | CRUD đầy đủ + chọn dùng chung hoặc riêng từng BU. |
| **D** | Gắn Contact vào phiếu thu chi | Combobox chọn contact trong form payment. |
| **E** | Báo cáo có cột Người Nộp/Nhận | Cập nhật cashflow + Excel exports. |
| **F** | Copy phiếu (đơn / giao dịch) | Nút Copy → mở form mới prefilled. |
| **B** | Đối tác (Party) chia sẻ giữa BU | Mỗi party tự chọn dùng chung hoặc riêng từng BU. |

---

## 2. Chi tiết khối lượng công việc

### Nhóm A — Phân quyền theo Đơn vị Kinh doanh *(làm trước tiên)*
| # | Hạng mục | Giờ | Chi phí |
|---|---|---:|---:|
| A1 | Schema + migration: thêm businessUnitId vào UserRoleAssignment + backfill SQL + seed | 4.5 | 540.000 ₫ |
| A2 | RBAC helper refactor + JWT/session + types | 6 | 720.000 ₫ |
| A3 | API enforcement (~30 route, ~101 callsite) + smoke tests cross-BU | 13 | 1.560.000 ₫ |
| A4 | UI: ma trận role × BU + BU switcher + sweep gating button | 7.5 | 900.000 ₫ |
| A5 | List/report filter theo BU access | 3.5 | 420.000 ₫ |
| | **Tiểu tổng A** | **34** | **4.140.000 ₫** |

### Nhóm C — Contact directory + chia sẻ giữa BU
| # | Hạng mục | Giờ | Chi phí |
|---|---|---:|---:|
| C1 | Schema Contact + ContactBusinessUnit (M2M) + migration | 2 | 240.000 ₫ |
| C2 | 5 endpoints API (list/create/get/update/delete) + Zod validation | 3.5 | 420.000 ₫ |
| C3 | API filter contact theo BU access | 1.5 | 180.000 ₫ |
| C4 | Trang settings/contacts: list + dialog form + search + active filter | 3.5 | 420.000 ₫ |
| C5 | UI contact form: multi-select BU + "Chung tất cả BU" | 1.5 | 180.000 ₫ |
| C6 | UI list: badge BU + filter | 1 | 120.000 ₫ |
| C7 | Audit logging CREATE/UPDATE/DELETE + tài liệu | 1 | 120.000 ₫ |
| | **Tiểu tổng C** | **14** | **1.680.000 ₫** |

### Nhóm D — Gắn Contact vào phiếu thu chi
| # | Hạng mục | Giờ | Chi phí |
|---|---|---:|---:|
| D1 | Schema: Transaction.contactId nullable + migration | 1 | 120.000 ₫ |
| D2 | API transactions: accept + validate contactId + include contact + filter theo BU access của contact | 2.5 | 300.000 ₫ |
| D3 | UI payment form: combobox autocomplete contact (sđt + tên) | 2.5 | 300.000 ₫ |
| D4 | UI standalone TX form + edit form: contact field + smoke test | 1.5 | 180.000 ₫ |
| | **Tiểu tổng D** | **7.5** | **900.000 ₫** |

### Nhóm E — Báo cáo có cột Người Nộp/Nhận
| # | Hạng mục | Giờ | Chi phí |
|---|---|---:|---:|
| E1 | Audit checklist các báo cáo cần update (~6 file Excel service) | 1 | 120.000 ₫ |
| E2 | Cập nhật API include contact trong query | 1.5 | 180.000 ₫ |
| E3 | UI table: cashflow + deposit tracking + sales/purchase detail | 3.5 | 420.000 ₫ |
| E4 | Excel exports (~6 file) thêm cột Người Nộp/Nhận | 3.5 | 420.000 ₫ |
| E5 | Smoke test xuất Excel + so sánh layout | 0.5 | 60.000 ₫ |
| | **Tiểu tổng E** | **10** | **1.200.000 ₫** |

### Nhóm F — Copy phiếu (đơn + giao dịch)
| # | Hạng mục | Giờ | Chi phí |
|---|---|---:|---:|
| F1 | Helper hook usePrefill (sessionStorage roundtrip) | 1 | 120.000 ₫ |
| F2 | Nút Copy + handler cho order list + order detail | 1.5 | 180.000 ₫ |
| F3 | Order new page consume prefill + smoke | 1.5 | 180.000 ₫ |
| F4 | Nút Copy + handler cho transaction list (standalone + order-linked) | 1.5 | 180.000 ₫ |
| F5 | Payment form / standalone TX form consume prefill + smoke | 2 | 240.000 ₫ |
| | **Tiểu tổng F** | **7.5** | **900.000 ₫** |

### Nhóm B — Party chia sẻ giữa BU *(làm cuối — tái dùng pattern từ C)*
| # | Hạng mục | Giờ | Chi phí |
|---|---|---:|---:|
| B1 | Schema PartyBusinessUnit (M2M) + migration backfill + verify | 2.5 | 300.000 ₫ |
| B2 | API party POST/PATCH atomic upsert M2M + GET join filter | 5 | 600.000 ₫ |
| B3 | Sweep mọi dropdown party (orders/transactions/deposits) theo BU access | 2.5 | 300.000 ₫ |
| B4 | UI party form: multi-select BU + checkbox "Chung tất cả BU" | 3.5 | 420.000 ₫ |
| B5 | UI party list: badge BU + filter | 1.5 | 180.000 ₫ |
| | **Tiểu tổng B** | **15** | **1.800.000 ₫** |

---

## 3. TỔNG CHI PHÍ (theo thứ tự thực hiện)

| Thứ tự | Nhóm | Giờ | Chi phí |
|---|---|---:|---:|
| 1 | A — RBAC per BU | 34 | 4.140.000 ₫ |
| 2 | C — Contact + multi-BU | 14 | 1.680.000 ₫ |
| 3 | D — TX gắn Contact | 7.5 | 900.000 ₫ |
| 4 | E — Báo cáo Người Nộp/Nhận | 10 | 1.200.000 ₫ |
| 5 | F — Copy phiếu | 7.5 | 900.000 ₫ |
| 6 | B — Party multi-BU | 15 | 1.800.000 ₫ |
| | **TỔNG** | **88** | **10.620.000 ₫** |

> **Báo giá làm tròn: 10.000.000 ₫** *(mười triệu đồng)*
> *Đã bao gồm thiết kế, lập trình, kiểm thử, tài liệu, triển khai và 1 tuần bảo hành lỗi.*

---

## 4. Tiến độ dự kiến

- **Tuần 1:** Nhóm **A** (RBAC per BU) — nền móng phân quyền.
- **Tuần 2:** Nhóm **C** (Contact + multi-BU) → **D** (TX Contact) → **E** (báo cáo).
- **Tuần 3:** Nhóm **F** (Copy) → **B** (Party multi-BU + sweep dropdown) → nghiệm thu.

**Thời gian bàn giao: ~3 tuần làm việc** (1 senior dev full-time).

### Ghi chú thứ tự
- **A đi đầu** vì cung cấp bảng BusinessUnit + RBAC helper + BU switcher mà C/B dùng.
- **B đặt cuối** vì Party đã tồn tại — pattern multi-BU viết ở C tái dùng cho B (tiết kiệm thời gian). Trong giai đoạn C → F, Party tạm giữ hành vi cross-BU cũ (sẽ thông báo trong nghiệm thu giữa kỳ).
- **F độc lập** với chuỗi multi-BU, có thể chạy song song với B nếu cần rút ngắn.
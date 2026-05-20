---
title: "Party multi-BU + Contacts + Copy phiếu"
description: "5 features: Contact directory + multi-BU sharing; add Contact to transactions + reports; copy any order/transaction; Party multi-BU sharing. Executes after RBAC per-BU (plan 260507-1039)."
status: completed
priority: P2
effort: 54h (~7 dev-days)
branch: main
tags: [party, contacts, transactions, reports, copy, schema-migration, multi-bu]
created: 2026-05-13
updated: 2026-05-20
blockedBy: [260507-1039-rbac-per-business-unit]
blocks: []
execution_order: [A, C, D, E, F, B]
---

# Party Multi-BU + Contacts + Copy

## Execution Order (chốt 2026-05-13)
**A → C → D → E → F → B** — A là plan RBAC per-BU riêng (`260507-1039-rbac-per-business-unit`), phải xong trước. Lý do: A cung cấp `BusinessUnit` table + RBAC helper + BU switcher; C/B dùng pattern multi-BU M2M cần nền tảng đó. Đặt B cuối vì Party đã tồn tại (hành vi cross-BU tạm chấp nhận trong giai đoạn chuyển tiếp), pattern multi-BU viết ở C5/C6 tái dùng cho B4/B5.

## Decisions
1. **Contact:** bảng riêng (cá nhân: tên, sđt, email, MST cá nhân, địa chỉ, ghi chú). M2M `ContactBusinessUnit` — per-contact chọn "Chung tất cả BU" hoặc tick từng BU (giống party).
2. **Transaction:** thêm `contactId?` (FK Contact, nullable). Dùng cho RECEIPT/PAYMENT (thu chi).
3. **Reports:** thêm cột **Người Nộp/Nhận** vào báo cáo thu chi + Excel export. Không đổi layout cũ.
4. **Copy:** button → mở form tạo mới với data prefilled (trừ số đơn + ngày). User sửa rồi save.
5. **Party scope:** per-party choice — M2M table `PartyBusinessUnit`. UI cho phép check "Chung tất cả BU" hoặc tick từng BU. Làm sau Contact để tái dùng pattern.

## Phases (thứ tự thực hiện)
| # | Group | Phase | Effort | Status |
|---|-------|-------|--------|--------|
| 0 | A | **Dependency** — RBAC per-BU (plan 260507-1039) | 34h | ✅ completed |
| 1 | C | [Schema Contact + Transaction.contactId](./phase-01-schema.md) | 3h | ✅ completed |
| 2 | C | [Contact CRUD + settings](./phase-02-contact-crud.md) | 11h | ✅ completed (no Contact-BU M2M — global directory) |
| 3 | D | [Transaction contact selector](./phase-03-transaction-contact.md) | 7.5h | ✅ completed |
| 4 | E | [Reports: Người Nộp/Nhận column](./phase-04-reports-contact.md) | 10h | ✅ completed (cashflow + summary export; deposit/sales-detail Excel deferred) |
| 5 | F | [Copy feature (orders + transactions)](./phase-05-copy-feature.md) | 7.5h | ✅ completed (sessionStorage prefill) |
| 6 | B | [Party multi-BU API + UI](./phase-06-party-multi-bu.md) | 15h | ✅ completed |
| 7 | — | [Tests + docs](./phase-07-tests-docs.md) | 3h | ✅ completed (unit tests written; vitest local install required to run) |

## Migrations (apply when DB reachable)
1. `20260520230100_add_contact_and_transaction_contact_id` — Contact + Transaction.contactId
2. `20260520230500_add_party_business_unit_m2m` — PartyBusinessUnit M2M + backfill

> **Note:** schema phase-01 đã rút gọn còn Contact + Transaction.contactId. Phần `PartyBusinessUnit` migration dồn vào phase-02 (B) để đặt cuối.

## Dependencies
- A (RBAC plan ngoài) blocks tất cả.
- C1 (schema) → C2 → D → E.
- F độc lập sau A (không cần C/D/E).
- B sau cùng — sweep dropdown party trong các form đã ổn định ở D/E.
- Tests + docs (phase-07) cuối.

## Success Criteria
- Có thể tạo party shared (chung TK + NT) → xuất hiện ở cả 2 BU lists.
- Tạo contact "Nguyễn A" với sđt + MST → chọn được trong form thu chi.
- Báo cáo cashflow + Excel có cột "Người Nộp/Nhận".
- Bấm Copy trên đơn bất kỳ → form tạo mới mở ra với toàn bộ field prefilled, user chỉ điền lại số đơn + ngày.
- ADMIN multi-BU vẫn nhìn thấy đúng dữ liệu sau migration.

## Risks
- **Party migration:** đổi `Party.businessUnitId` (nullable hay xóa cột?) → quyết định: **giữ cột** làm "primary BU" (BU tạo ra), thêm M2M `PartyBusinessUnit` chứa danh sách BU được dùng. Backfill: insert M2M row cho mỗi party hiện có với chính `businessUnitId` đó. Query đổi sang join M2M.
- **List filter complexity:** orders/transactions/deposits filter party theo BU access — giờ phải kiểm party có thuộc BU không qua M2M.
- **Copy đơn có TX:** chỉ copy đơn (không copy TX). Copy TX riêng. Tránh ambiguity.
- **Contact PII:** sđt, email, MST → cần audit log ghi đầy đủ.

## Cost Estimate
Xem [cost-estimate.md](./cost-estimate.md).

## Out of Scope
- Merge/dedupe party trùng tên giữa BU (di sản từ pre-multi-BU).
- Copy bulk (nhiều đơn cùng lúc).
- Soft-delete contact (chỉ active/inactive).

## Transitional Behavior
Trong giai đoạn từ khi A xong → B chưa xong (tức suốt C/D/E/F):
- Party vẫn giữ hành vi cũ (cross-BU theo `Party.businessUnitId` đơn lẻ) — chấp nhận tạm.
- Contact đã có multi-BU đầy đủ ngay từ C.
- Sau B, dropdown party trong order/transaction/deposit mới sweep filter theo BU access.

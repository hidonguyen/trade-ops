# Phase 05 — Reports: Người Nộp/Nhận Column

**Effort:** 8h | **Depends on:** Phase 04

## Affected reports
- Cashflow report (chính) — `app/(dashboard)/cashflow/`, `app/api/cashflow/...`, `lib/excel-cashflow-*.ts`.
- Sales detail / Purchase detail Excel (đã có order party) — thêm cột contact cho TX rows.
- Deposit tracking — TX rows có contact.
- Bất cứ báo cáo nào liệt kê transactions.

## Changes per report
1. API include `contact: { select: { id, name } }` trong query.
2. UI table: thêm cột "Người Nộp/Nhận" (sau cột Party).
3. Excel service: thêm column header + cell mapping.

## Files (approximate)
- `lib/excel-cashflow-helpers.ts`
- `lib/excel-cashflow-summary-service.ts`
- `lib/excel-deposit-tracking-service.ts`
- `lib/excel-sales-detail-service.ts`
- `lib/excel-order-reports-service.ts`
- Cashflow report page + table component
- Deposit tracking detail table

## Todo
- [ ] Audit which reports show TX rows → checklist
- [ ] Update API includes
- [ ] Add column to UI tables
- [ ] Add column to Excel exports
- [ ] Verify column width + i18n header

## Success
Mở báo cáo cashflow → có cột "Người Nộp/Nhận" với tên contact (rỗng nếu null). Xuất Excel → cột xuất hiện đúng vị trí.

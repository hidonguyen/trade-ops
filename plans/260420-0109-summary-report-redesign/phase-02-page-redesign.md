# Phase 02 — Summary Report Page Redesign

## Overview
- **Priority:** high
- **Status:** pending (blocked by phase-01)
- Rewrite summary page with 4 tabs showing detailed rows

## Related Code Files
- `app/(dashboard)/reports/summary/page.tsx` — full rewrite

## Implementation

### Tab Structure
- "Thu từ khách hàng" — DataTable with order debt columns
- "Thu khác" — DataTable with standalone transaction columns
- "Chi trả nhà cung cấp" — DataTable with order debt columns
- "Chi khác" — DataTable with standalone transaction columns

### Order Debt Table Columns
STT | Khách hàng/NCC | Mã đơn | Ngày đơn | Nợ cũ | TT lần này | Nợ còn lại | Ghi chú

### Standalone Table Columns
STT | Ngày | Số tiền | Tiền tệ | Phương thức | Tham chiếu | Ghi chú

### Features
- FilterBar: dateFrom, dateTo (default: this week), DateQuickPresets
- Tab pills (same style as current)
- CSV export per tab
- Summary totals at bottom of each tab

## Todo List
- [ ] Rewrite summary page with 4 tabs
- [ ] Order debt table for customer/supplier tabs
- [ ] Standalone table for other receipts/payments
- [ ] CSV export
- [ ] Verify compile

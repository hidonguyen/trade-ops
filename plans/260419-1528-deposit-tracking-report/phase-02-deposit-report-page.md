# Phase 02 — Deposit Report Page UI

## Overview
- **Priority:** high
- **Status:** pending (blocked by phase-01)
- New report page at `/reports/deposits`

## Related Code Files
- `app/(dashboard)/reports/deposits/page.tsx` — NEW
- `components/layout/sidebar.tsx` — add nav item

## Implementation

### 1. Create report page
- FilterBar: dateFrom, dateTo (default: this week), party combobox, currency combobox
- DateQuickPresets below FilterBar
- DataTable with columns from plan.md
- Pagination
- eventType rendered as badge:
  - DEPOSIT_CREATED → "Đặt cọc" (blue)
  - DEPOSIT_USED → "Trừ cọc" (red)
  - DEPOSIT_REFUNDED → "Hoàn cọc" (green)

### 2. Add to sidebar
- Under "Báo cáo" section: `{ label: "Theo dõi cọc", href: "/reports/deposits", icon: WalletIcon }`

## Todo List
- [ ] Create report page with filters + table
- [ ] Add sidebar nav item
- [ ] Verify compile

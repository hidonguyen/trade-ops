---
title: "Filter persist + initial fetch — fix multi-call race & add manual query button"
description: "Reports trigger nhiều fetch tuần tự khi mount (defaults → persisted → BU load → filter change), không có abort, dễ race. Sửa gating + abort, sau đó thay auto-fetch bằng nút Truy vấn."
status: pending
priority: P2
effort: 2h
branch: main
tags: [reports, filters, ux, consistency]
created: 2026-05-05
blockedBy: []
blocks: []
---

# Filter Fetch Consistency

## Diagnosis (xác nhận có vấn đề)

Trên mỗi trang report (`reports/summary`, `cashflow`, `deposits`, `bank-fees`), mount lifecycle gây **nhiều fetch tuần tự** với filter values khác nhau:

| # | Trigger | Filter snapshot |
|---|---------|----------------|
| 1 | Mount: `getInitialDateRange()` = this-week | defaults |
| 2 | `useRestorePersistedDateRange` chạy post-mount → `setFilters({...prev, ...persisted})` | persisted (nếu có) |
| 3 | `selectedBuId` async từ BU provider | + buId |
| 4 | User đổi filter | merged |
| 5 | Toggle `hideDepleted` (deposits page) | merged |

`useEffect(fetchReport)` chạy mỗi khi `fetchReport` (memoed trên `[filters, selectedBuId, buLoaded, hideDepleted]`) đổi → mỗi state update = 1 fetch.

**Hệ quả:**
- **Wasted requests**: 2-3 fetch khi vào trang mới (defaults → persisted → buLoaded).
- **Race**: response cũ có thể về sau response mới (không có `AbortController`) → bảng hiện data sai.
- **Flash content**: bảng hiện data this-week → flash sang persisted range.

## User Decisions

1. **Áp dụng**: TẤT CẢ 8 trang dùng FilterBar — `reports/summary`, `reports/cashflow`, `reports/deposits`, `reports/bank-fees`, `orders`, `transactions`, `parties`, `settings/audit-logs`.
2. **Nút "Truy vấn"** đặt trong FilterBar (thêm prop `onSubmit`). DateQuickPresets vẫn auto-apply (thay đổi 2 fields cùng lúc, ít risk).
3. **Initial fetch**: vẫn fetch tự động lần đầu sau khi persisted + BU đã load (gated). Sau đó chỉ fetch khi click nút.
4. **Persist**: ghi `appliedFilters` (đã commit qua nút Truy vấn), KHÔNG persist draft chưa apply.

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [Gate initial fetch + AbortController](./phase-01-gate-and-abort.md) | pending | 8 pages (4 reports + orders/transactions/parties/audit-logs) |
| 2 | [Manual "Truy vấn" button](./phase-02-query-button.md) | pending | `components/shared/filter-bar.tsx`, 8 pages |

## Dependencies
- Phase 1 → Phase 2 (gate logic là baseline)

## Success Criteria
- Vào trang report → đúng **1 fetch** với filter cuối cùng (persisted + BU đã ready).
- Đổi filter → **không** fetch ngay; chỉ fetch khi click "Truy vấn".
- Đổi filter rapid → response cũ bị abort, bảng không nhấp nháy.
- Quick-presets vẫn fetch ngay (tiện UX).

## Rollback
Per-file revert.

---
title: "Theo dõi cọc — toggle ẩn cọc hết, mặc định mở detail, xuất Excel"
description: "Bổ sung 3 nâng cấp cho /reports/deposits sau master-detail: filter remaining=0, expand-all default, Excel export"
status: pending
priority: P3
effort: 1.5h
branch: main
tags: [reports, deposits, excel]
created: 2026-05-05
blockedBy: []
blocks: []
---

# Deposit Tracking — Enhancements

## Context
- Plan trước (`260505-0218-deposit-tracking-master-detail`) đã build master-detail UI + API.
- User feedback: 3 tinh chỉnh.

## User Decisions
1. **Hide depleted**: thêm checkbox "Ẩn cọc đã hết số dư" — khi on, ẩn deposit có `remainingOriginal = 0`. Mặc định **on** (cleaner default — cọc hết thường ít quan tâm).
2. **Default expanded all**: thay vì click-to-expand, list detail luôn render. Bỏ chevron toggle. Master row vẫn rõ ràng do styling khác detail.
3. **Excel export**: nút "Xuất Excel" cạnh title. Multi-sheet xls hoặc 1 sheet phẳng — chọn 1 sheet phẳng (master + detail interleave) cho KISS.

## Phases
| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [UI + API filter, expand-all](./phase-01-ui-api-filter-expand.md) | pending | `app/(dashboard)/reports/deposits/page.tsx`, `app/api/reports/deposits/route.ts` |
| 2 | [Excel export](./phase-02-excel-export.md) | pending | `app/api/reports/deposits/export/route.ts` (new), `lib/excel-deposit-tracking-service.ts` (new) |

## Dependencies
- Phase 1 → Phase 2 (Excel reuses API data shape)

## Success Criteria
- Default load: ẩn deposit có `remainingOriginal=0`. Toggle off → hiện cả.
- Tất cả deposit hiển thị detail luôn (không click).
- Nút "Xuất Excel" tải `.xlsx`: 1 sheet, master rows + indented detail rows.

## Rollback
- Per-file revert.

## Open Questions
- Hide-depleted có nên áp dụng SAU date-filter (deposit có usage in-period nhưng số dư=0 hiện tại) hay TRƯỚC? → Recommend AFTER (hide bất kể có activity in-period — số dư hết là dấu hiệu deposit kết thúc).

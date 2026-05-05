---
title: "Reports — order detail modal (in-app, blocking)"
description: "Replace new-tab open with in-app modal showing order detail (read-only). Modal blocks interaction until closed. Reuses existing OrderInfoCard/FinancialSummaryCard/OrderTransactionsTable."
status: completed
priority: P2
effort: 2h
branch: main
tags: [reports, ui, modal]
created: 2026-05-05
blockedBy: []
blocks: []
---

# Reports — Order Detail Modal

## Context
- Previous plan `260505-1534-report-clickable-order-link` added external-link icon → opens `/orders/[id]` in new tab.
- User wants modal-like UX: must close to interact again. Browser cannot enforce always-on-top → use in-app Dialog (blocks page via overlay).
- Reuse: `app/(dashboard)/orders/[id]/order-info-card.tsx`, `financial-summary-card.tsx`, `order-transactions-table.tsx`. API `/api/orders/[id]/report` already exists.

## Decisions (confirmed)
1. Modal/Dialog (Base UI primitive, already used) — not popup window, not iframe.
2. Render existing card components directly — no iframe, no rewrite.
3. Read-only inside modal: no edit/payment/adjustment buttons (link to full page if needed via "Mở trang đầy đủ" button).
4. Trigger via context: `OrderLinkCell` calls `useOrderDetailModal().open(orderId)` instead of `<a target=_blank>`.

## Architecture
```
ReportsLayout (provider)
  └── OrderDetailModalProvider (state: open, orderId)
        ├── OrderDetailModal (renders Dialog + fetches /api/orders/[id]/report)
        └── children (report pages)
              └── OrderLinkCell → useOrderDetailModal().open(orderId)
```

## Phases
| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [Modal + provider + hook](./phase-01-modal-provider.md) | completed | new: `components/reports/order-detail-modal.tsx`, `components/reports/order-detail-modal-provider.tsx` |
| 2 | [Wire OrderLinkCell + reports layout](./phase-02-wire-link-cell.md) | completed | `components/reports/order-link-cell.tsx`, `app/(dashboard)/reports/layout.tsx` (create if absent) |

## Dependencies
Phase 1 → Phase 2.

## Success Criteria
- Click icon trên row có orderId → modal mở overlay, page bên dưới không thao tác được.
- Modal hiển thị info + summary + transactions (read-only).
- Click nút X / overlay / Esc → đóng modal, page interactive trở lại.
- Có nút "Mở trang đầy đủ" → router.push hoặc link bình thường tới `/orders/{id}` cho trường hợp cần edit.
- Không regression với 3 báo cáo (summary, cashflow, deposits).

## Rollback
Revert OrderLinkCell to `<a target=_blank>`; remove provider/modal files.

## Open Questions
None.

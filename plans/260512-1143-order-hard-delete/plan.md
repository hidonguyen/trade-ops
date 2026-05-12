---
title: "Order hard delete (admin only)"
description: "Hard-delete orders; block delete if any transaction exists; admin-only."
status: in-progress
priority: P2
effort: 4h
branch: main
tags: [orders, delete, rbac, audit]
created: 2026-05-12
blockedBy: []
blocks: []
---

# Order Hard Delete

## Decisions
- **Block** if order has any `Transaction` (payment/refund/deposit). 409 with explicit reason.
- **Hard delete:** `DELETE FROM "Order"`. Audit log preserves full snapshot — no restore feature.
- **RBAC:** ADMIN only.

## Phases
| # | Phase | Effort | Files |
|---|-------|--------|-------|
| 1 | [DELETE API endpoint](./phase-01-api.md) ✅ | 1.5h | `app/api/orders/[id]/route.ts`, `lib/messages.ts` |
| 2 | [UI: delete button + confirm](./phase-02-ui.md) ✅ | 2h | `app/(dashboard)/orders/[id]/page.tsx` |
| 3 | [Audit + smoke test](./phase-03-audit-test.md) ⏳ | 0.5h | manual test |

## Success
- Admin deletes order without TX → row removed from DB; audit log keeps full snapshot.
- Admin tries to delete order with TX → 409 "Đơn đã có giao dịch, không thể xóa".
- Non-admin: button hidden + 403 on direct API call.
- After delete, same `orderNumber` can be reused for that party (no constraint conflict).

## Risks
- **Irreversible.** Audit log is the only record. Confirm dialog must be explicit ("Không thể khôi phục").
- **Foreign keys:** `Transaction.orderId` → blocked by FK if TX exists (DB-level safety net even if API check is bypassed). No cascade.

## Out of Scope
- Soft delete / restore (explicitly rejected — user chose hard delete).
- Bulk delete.
- Non-admin delete.

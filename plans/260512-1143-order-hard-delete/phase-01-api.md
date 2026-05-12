# Phase 01 — DELETE API

**Effort:** 1.5h

## Endpoint: `DELETE /api/orders/[id]`

1. `requireAccess(ADMIN)` via existing RBAC helper.
2. Load order; if not found → 404.
3. `prisma.transaction.count({ where: { orderId: id } })` — if > 0 → 409 `{ error: "ORDER_HAS_TRANSACTIONS", message: "Đơn đã có giao dịch, không thể xóa" }`.
4. Inside transaction:
   - Snapshot full order (with related fields) for audit `before`.
   - `prisma.order.delete({ where: { id } })`.
   - Insert audit log: action `DELETE_ORDER`, before = snapshot, after = null.
5. Return 204.

## Schema
No schema change. FK `Transaction.orderId` has no cascade — DB rejects delete if any TX exists (safety net).

## Todo
- [ ] Add DELETE handler in `app/api/orders/[id]/route.ts`
- [ ] Verify FK blocks deletion when TX exists (sanity test even with API check)
- [ ] Audit entry includes full snapshot

# Phase 2 — UI gating: orders + parties + settings

Use `useCan(action, module)` from `@/components/providers/roles-provider` (already wired).

## Orders list `app/(dashboard)/orders/page.tsx`
Module = SALE or PURCHASE based on `urlType` (the active filter `?type=SALE|PURCHASE`).
- "Tạo đơn" button: `useCan("CREATE", urlType === "SALE" ? "SALE" : "PURCHASE")`. Hide when not allowed.
- Per-row Edit/Delete buttons (if any): same module check.

## Order detail `app/(dashboard)/orders/[id]/page.tsx`
Module derived from `order.type`. Buttons:
- "Sửa" → `useCan("UPDATE", module)`
- "Xóa" (if any) → `useCan("DELETE", module)`
- "Thanh toán" (creates RECEIPT for SALE / PAYMENT for PURCHASE):
  - SALE order → needs `useCan("CREATE", "RECEIPT")`
  - PURCHASE order → needs `useCan("CREATE", "PAYMENT")`
- "Hoàn tiền" (creates the opposite direction tx):
  - SALE order → REFUND is PAYMENT direction → `useCan("CREATE", "PAYMENT")`
  - PURCHASE order → REFUND is RECEIPT direction → `useCan("CREATE", "RECEIPT")`
- "Điều chỉnh" (ADJUSTMENT) → uses order module: `useCan("UPDATE", module)` (treat as order edit)

In transactions sub-table (`OrderTransactionsTable`): per-row Edit/Delete check based on `tx.type` (RECEIPT/PAYMENT). The component already accepts `canEdit`/`canDelete` props — pass computed values from parent.

## Parties `app/(dashboard)/parties/page.tsx` + `[id]`
Module = CUSTOMER or SUPPLIER per `?type=CUSTOMER|SUPPLIER` or `party.type`.
- "Tạo / Sửa / Xóa" buttons gated by `useCan("CREATE"|"UPDATE"|"DELETE", module)`.

## Settings `app/(dashboard)/settings/**`
Already gates page-level access (`isAdmin` check). Verify each sub-section's create/edit/delete buttons use ADMIN module check via useCan instead of raw `roles.includes("ADMIN")` for consistency.

## Pattern
Add hook calls at top of each component, then `{canX && <Button .../>}`.

## Todo
- [ ] Orders list: Tạo button gate
- [ ] Order detail: Sửa, Thanh toán, Hoàn tiền, Điều chỉnh gates + pass canEdit/canDelete to OrderTransactionsTable
- [ ] Parties list + detail: CRUD button gates
- [ ] Settings: convert isAdmin checks to useCan("UPDATE"/"DELETE", "ADMIN") where applicable
- [ ] Visual smoke as ACCOUNTANT_SALE: PURCHASE order tab shows no edit buttons; PAYMENT-tx rows on SALE orders show no edit/delete
- [ ] `tsc --noEmit` clean

## Success Criteria
- No write button visible for an action the role cannot perform.
- Server still 403s as defense-in-depth.

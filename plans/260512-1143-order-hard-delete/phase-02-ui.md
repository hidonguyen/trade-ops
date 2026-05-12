# Phase 02 — UI: Delete Button + Confirm

**Effort:** 2h | **Depends on:** Phase 01

## Order list row
- Add **Xóa** option in action menu (red text).
- Hidden when `!isAdmin`.
- Disabled with tooltip if `order.transactions.length > 0` → "Đã có giao dịch — không thể xóa".

## Order detail page
- Add **Xóa đơn** button in header (destructive variant).
- Same visibility rules.

## Confirm dialog
- Title: "Xóa đơn #{orderNumber}?"
- Body: "Hành động này **không thể khôi phục**. Đơn sẽ bị xóa vĩnh viễn khỏi hệ thống."
- Confirm button: "Xóa vĩnh viễn" (destructive).
- Cancel: "Hủy".

## After delete
- Toast success: "Đã xóa đơn #{orderNumber}".
- From list: refresh data.
- From detail: redirect to order list.

## Error handling
- 409 ORDER_HAS_TRANSACTIONS → toast error with message from API.
- 403 → toast "Bạn không có quyền".

## Todo
- [ ] Delete menu item on list row
- [ ] Delete button on detail header
- [ ] Confirm dialog (reuse existing destructive confirm if available)
- [ ] Wire up `useMutation` → DELETE call
- [ ] Toast + redirect
- [ ] Verify hidden for non-admin

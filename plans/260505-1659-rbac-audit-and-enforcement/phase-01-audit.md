# Phase 1 — Audit (no code changes)

Produce a divergence report. Save to `plans/reports/rbac-audit-260505-1659.md`.

## Tasks

### 1.1 Verify session roles
- Confirm session.user.roles for the reporting user contains only `ACCOUNTANT_SALE` (not also `ADMIN`).
- Inspect `lib/auth.ts` callbacks (`session`, `jwt`) for how `roles` is populated. Check for hardcoded role push.
- Query DB: `SELECT u.email, array_agg(ur.role) FROM users u JOIN user_roles ur ON ur.user_id=u.id GROUP BY u.id;` (use psql).
- **Output:** confirmed role set per test user.

### 1.2 Endpoint matrix audit
For each of 32 `app/api/**/route.ts`:
- List HTTP methods + the `checkAccess(roles, METHOD, MODULE)` call (or absence).
- Note the implicit module choice — many endpoints hardcode one module but handle mixed-purpose data (e.g. `transactions/[id]` PUT might handle both RECEIPT and PAYMENT tx).
- Flag divergences:
  - Missing `checkAccess` entirely
  - Wrong module (e.g. uses RECEIPT for PAYMENT-type tx)
  - Module-action pair that lets ACCOUNTANT_SALE write to PAYMENT
- **Output:** table `route | method | module | action | matrix-result-by-role | bug?`.

### 1.3 UI gating audit
- `components/layout/sidebar.tsx` — verify `adminOnly` actually hides; check why Settings showed for the test user (likely 1.1 finding).
- All page-level action buttons (Tạo, Sửa, Xóa, Thanh toán, Hoàn tiền, Điều chỉnh):
  - `app/(dashboard)/orders/page.tsx`, `orders/[id]/page.tsx`
  - `app/(dashboard)/transactions/page.tsx`, `transactions/new/page.tsx`
  - `app/(dashboard)/parties/**`
  - `app/(dashboard)/settings/**`
- For each: does the JSX gate visibility on `checkAccess` / role? If not → flag.
- Forms: `payment-form.tsx`, `order-form.tsx`, `order-adjustment-form.tsx` — submit allowed for unauthorized role would surface 403, but ideally hide entry point.

### 1.4 Special: PAYMENT vs RECEIPT branching
Many transaction endpoints use a single module guard. The matrix distinguishes RECEIPT (money in) from PAYMENT (money out). For ACCOUNTANT_SALE:
- Create REFUND on a SALE order → outflow (PAYMENT-like) but linked to SALE? Need rule clarification.
- Create PAYMENT on a PURCHASE order → matrix says DENY.
- The actual module choice should depend on `tx.type` (RECEIPT/PAYMENT enum from Prisma), not the HTTP route shape.
- Output recommended mapping:
  - tx.type=RECEIPT → module=RECEIPT
  - tx.type=PAYMENT → module=PAYMENT
  - tx.type=ADJUSTMENT → module=SALE if order.type=SALE else PURCHASE

## Deliverable
Single markdown report at `plans/reports/rbac-audit-260505-1659.md` containing:
1. Confirmed roles per test user
2. Endpoint divergence table
3. UI gating divergence list
4. Recommended fix list ranked by severity (security-critical first)

## Todo
- [ ] DB query for user roles
- [ ] Read `lib/auth.ts` for role population
- [ ] Iterate 32 routes, build matrix table
- [ ] Iterate dashboard pages for UI gates
- [ ] Write divergence report

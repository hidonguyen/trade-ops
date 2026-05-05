# Phase 3 — UI gating

After server is locked down (Phase 2), align UI to hide unauthorized actions.

## Helper
Add `lib/rbac-client.ts`:
```ts
import type { RbacAction, RbacModule } from "@/types";
export function canDoClient(roles: string[], action: RbacAction, module: RbacModule): boolean {
  // mirror of server checkAccess for UI gating only — server stays authoritative
  // ... copy logic from api-helpers.ts (or extract shared module)
}
```
Better: extract `permissionMatrix` + `checkAccess` to `lib/rbac.ts` (server-safe, no Node-only deps), import from both `api-helpers.ts` and client components.

## Components to gate
| Component | Action | Module gate |
|-----------|--------|-------------|
| `sidebar.tsx` Settings group | Already `adminOnly` — verify Phase 1 finding root cause | ADMIN/POST |
| Order list `Tạo` button | Hide if no POST to SALE/PURCHASE for the active order type | SALE/POST or PURCHASE/POST |
| Order detail `Sửa` `Xóa` `Thanh toán` `Hoàn tiền` `Điều chỉnh` | Per matrix — many gates | SALE or PURCHASE per order.type; PAYMENT vs RECEIPT per tx flow |
| Transaction list `Tạo` | RECEIPT/POST or PAYMENT/POST | |
| Transaction row `Sửa` `Xóa` | Module per tx.type | |
| Party list `Tạo` `Sửa` `Xóa` | CUSTOMER or SUPPLIER per party.type | |

## Pattern
```tsx
const { roles } = useSession();
const canEditPayment = canDoClient(roles, "PUT", "PAYMENT");
{canEditPayment && <Button onClick={...}>Sửa</Button>}
```

## Todo
- [ ] Extract `permissionMatrix` to `lib/rbac.ts`; re-export from `api-helpers.ts`
- [ ] Add `useCan(action, module)` hook for client gating
- [ ] Apply gates per table above
- [ ] Visual smoke test as ACCOUNTANT_SALE: PAYMENT buttons hidden, Settings menu hidden
- [ ] Visual smoke test as ADMIN: everything visible

## Success Criteria
- No unauthorized button visible to a role.
- Server still returns 403 if a client somehow calls (defense-in-depth).

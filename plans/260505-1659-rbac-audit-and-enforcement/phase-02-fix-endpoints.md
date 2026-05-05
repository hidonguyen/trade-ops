# Phase 2 — Fix endpoint gaps

Driven by Phase 1 divergence report. Apply fixes route-by-route.

## Anticipated fix patterns

### A. Wrong module on transaction edit/delete
Endpoints handling mixed RECEIPT/PAYMENT tx must select module based on `tx.type` AFTER fetching the row:

```ts
const tx = await prisma.transaction.findUnique({ where: { id }, select: { type: true } });
if (!tx) return 404;
const module = tx.type === "PAYMENT" ? "PAYMENT" : "RECEIPT";
if (!checkAccess(session.user.roles, request.method, module)) return 403;
```

Files likely affected:
- `app/api/transactions/[id]/route.ts` (PUT/DELETE)
- `app/api/orders/[id]/transactions/route.ts` (POST)
- `app/api/orders/[id]/transactions/[txId]/route.ts` (PUT/DELETE)

### B. Adjustment endpoint
ADJUSTMENT tx routes through SALE or PURCHASE module based on `order.type`:
```ts
const module = order.type === "SALE" ? "SALE" : "PURCHASE";
```

### C. Missing checkAccess
Add `checkAccess` to any route that lacks it (Phase 1 lists). Default action = HTTP method.

### D. Admin-only routes
Verify `app/api/admin/**` and any settings routes guard with `module="ADMIN"`.

## Constraint
- Do NOT change `permissionMatrix`. Matrix is source of truth.
- Server-side enforcement first (security boundary). UI gating in Phase 3.
- Keep error message generic (`MSG.accessDenied`); avoid leaking permission details.

## Todo
- [ ] Apply fix per route from Phase 1 report
- [ ] Re-run `tsc --noEmit`
- [ ] Manual test: hit a forbidden endpoint as ACCOUNTANT_SALE → expect 403
- [ ] Manual test: hit allowed endpoint as ACCOUNTANT_SALE → expect 2xx

---
title: Granular order-edit locks (amount/currency vs party)
description: Relax order PATCH from all-or-nothing transaction lock to per-field rules; lock amountOriginal+currencyId when any transaction exists, lock partyId only when a DEPOSIT-method transaction exists
status: completed
completed: 2026-04-29
priority: P2
effort: ~1.5h
branch: main
tags: [orders, api, ui, validation, audit]
created: 2026-04-29
blockedBy: []
blocks: []
---

# Plan: Granular order-edit locks

## Context

Current order PATCH (`app/api/orders/[id]/route.ts:98-107`) blocks edits to `amountOriginal`, `partyId`, AND `currencyId` whenever ANY `Transaction` exists. User wants more granular rules:

- **Has any transaction (PAYMENT or REFUND)** → lock `amountOriginal` + `currencyId` (financial integrity).
- **Has any DEPOSIT-method transaction** → lock `partyId` (deposit usage tied to party).
- **Otherwise (BANK-only or no transactions)** → `partyId` editable.
- Other fields (`notes`, `orderDate`, `orderNumber`, `exchangeRate`, `paymentDueDate`, `expenseTypeId`) remain always editable (already correct).

UI today doesn't disable these fields in edit mode — user only learns via 409 on submit. We add server enforcement + client-side disabled state with tooltips.

## Why party can be edited under BANK-only transactions

- `Transaction.orderId` is the only link; no direct `Transaction.partyId`. Changing `Order.partyId` automatically reassigns the transaction to the new party (party totals are computed from joins).
- DEPOSIT-method transactions reference `DepositUsage → Deposit → Party` — changing the order's party would orphan deposits tied to the old party. Must stay locked.

## Decisions (locked)

1. **Server lock predicates:**
   - `hasTx = transactions.length > 0` → `amountOriginal`, `currencyId` locked.
   - `hasDepositTx = transactions.some(t => t.paymentMethod === "DEPOSIT")` → `partyId` locked.
   - 409 with field-specific message when violated.
2. **Client lock predicates:** mirror server. Pass `lockAmountCurrency` + `lockParty` into `OrderForm`. Disable combobox/input + show tooltip explaining reason.
3. **Audit:** existing `diffForAudit` captures changes (no change needed).
4. **Cache:** existing `invalidateTags([reportsByBu, order])` covers everything (no change).
5. **No schema migration.** Pure logic change.
6. **RBAC unchanged.** Existing `checkAccess(roles, "UPDATE", module)` enforced.

## Scope

| Layer | File | Change |
|---|---|---|
| API | `app/api/orders/[id]/route.ts` | Replace single `hasTransactions` check with `hasTx` + `hasDepositTx` predicates and per-field 409s |
| Messages | `lib/messages.ts` | Add `cannotModifyParty` (deposit-bound), refine `cannotModifyFinancial` to amount/currency only |
| UI form | `components/order-form.tsx` | Add `lockAmountCurrency?: boolean`, `lockParty?: boolean` props; disable corresponding fields with tooltip hint |
| UI page | `app/(dashboard)/orders/[id]/edit/page.tsx` | Compute predicates from fetched `order.transactions`, pass props to `OrderForm` |
| (optional) Detail card | `app/(dashboard)/orders/[id]/order-info-card.tsx` | If "Edit" button visibility depends on lock state — leave button shown; locks live inside form |

## Implementation outline

### 1. API (`app/api/orders/[id]/route.ts`)

Replace lines 98–107 with:

```ts
const hasTx = order.transactions.length > 0;
const hasDepositTx = order.transactions.some(
  (t) => t.paymentMethod === "DEPOSIT"
);

if (hasTx && (amountOriginal !== undefined || currencyId !== undefined)) {
  return Response.json(
    apiResponse(false, undefined, MSG.cannotModifyFinancial),
    { status: 409 }
  );
}
if (hasDepositTx && partyId !== undefined && partyId !== order.partyId) {
  return Response.json(
    apiResponse(false, undefined, MSG.cannotModifyParty),
    { status: 409 }
  );
}
```

Update the conditional copy (lines 127–131):

```ts
if (!hasTx) {
  if (amountOriginal !== undefined) updateData.amountOriginal = amountOriginal;
  if (currencyId !== undefined) updateData.currencyId = currencyId;
}
if (!hasDepositTx && partyId !== undefined) {
  updateData.partyId = partyId;
}
```

Also extend the Prisma `findUnique` include to fetch `paymentMethod` only:
```ts
include: { transactions: { select: { id: true, paymentMethod: true } } },
```

### 2. Messages (`lib/messages.ts`)

```ts
cannotModifyFinancial: "Không thể sửa số tiền hoặc tiền tệ khi đã có giao dịch thanh toán",
cannotModifyParty: "Không thể đổi đối tác khi đã thanh toán bằng cọc",
```

### 3. Form component (`components/order-form.tsx`)

Extend props:
```ts
interface OrderFormProps {
  initialData?: Partial<OrderFormData> & { id?: string };
  onSubmit: (data: OrderFormData) => Promise<void>;
  mode: "create" | "edit";
  lockType?: boolean;
  lockAmountCurrency?: boolean; // any tx exists
  lockParty?: boolean;          // any DEPOSIT tx exists
}
```

Apply to fields:
- Đối tác combobox: `disabled={lockParty}` + helper text "Đã thanh toán bằng cọc" beneath.
- Tiền tệ combobox: `disabled={lockAmountCurrency}` + helper "Đã có giao dịch".
- Số tiền NumberInput: `disabled={lockAmountCurrency}`.

(`exchangeRate` stays editable — confirmed unaffected.)

### 4. Edit page (`app/(dashboard)/orders/[id]/edit/page.tsx`)

After fetching order, compute predicates from `order.transactions`:

```ts
const txList = (order as any).transactions ?? [];
const lockAmountCurrency = txList.length > 0;
const lockParty = txList.some((t: any) => t.paymentMethod === "DEPOSIT");
```

Pass to form:
```tsx
<OrderForm
  mode="edit"
  initialData={initialData}
  onSubmit={handleSubmit}
  lockAmountCurrency={lockAmountCurrency}
  lockParty={lockParty}
/>
```

Extend the `OrderData` interface and `useState` typing to include `transactions: { paymentMethod: string }[]` so TS stays clean.

### 5. handleSubmit guard (defensive)

If a field is locked client-side, don't include it in PATCH body. Avoids accidentally sending unchanged-equal `partyId` and tripping the deposit guard. Already covered: server compares `partyId !== order.partyId` — sending the same value is a no-op.

## Edge cases

| Case | Behavior |
|---|---|
| Order has only REFUND transactions (no PAYMENT) | `hasTx = true` → amount/currency locked. Correct: refund history depends on order amount. |
| Order has BANK PAYMENT only | `hasTx=true`, `hasDepositTx=false` → party editable, amount/currency locked. |
| Order has DEPOSIT PAYMENT (any) | both locks active. |
| User submits unchanged partyId on a deposit-locked order | Server `partyId !== order.partyId` check skips the 409. ✓ |
| Concurrent transaction creation between fetch and save | Server re-checks; 409 returned. UI surfaces error. (Current behavior, unchanged.) |
| Locked field bypassed via direct API call | Server still enforces (defense in depth). |

## Acceptance criteria

- [ ] PATCH with `amountOriginal` or `currencyId` while any transaction exists → 409 + `cannotModifyFinancial`.
- [ ] PATCH with new `partyId` while any DEPOSIT-method tx exists → 409 + `cannotModifyParty`.
- [ ] PATCH with new `partyId` while only BANK-method tx exist → 200 + party updated, audit recorded.
- [ ] PATCH with `notes`/`orderDate`/`orderNumber`/`expenseTypeId`/`exchangeRate`/`paymentDueDate` always succeeds regardless of transactions (no regression).
- [ ] UI edit page: amount + currency disabled with helper text when transactions exist.
- [ ] UI edit page: party disabled with helper text when DEPOSIT tx exists; editable otherwise.
- [ ] Type-check passes (`npm run type-check`).
- [ ] Manual: SALE order with BANK payment → change party → success.
- [ ] Manual: SALE order with DEPOSIT payment → party combobox disabled.
- [ ] Manual: order with no transactions → all fields editable as before.

## Risks

- **Party-switch on BANK-paid order shifts party totals retroactively** — intentional per user, but may surprise reports. Mitigated by audit log.
- **Existing tests** assume current all-or-nothing lock; need updates if any cover this path.
- **Cache invalidation:** `partyId` change must invalidate both old + new party caches. Current code only invalidates `TAG.order(id)` and `TAG.reportsByBu(buId)`. Check if a `TAG.party(partyId)` invalidation should be added for both old + new.

## Phases

Single phase — implement directly per outline above.

## Todo

- [x] Update `app/api/orders/[id]/route.ts` PATCH lock predicates + transaction include
- [x] Add `MSG.cannotModifyParty`, refine `MSG.cannotModifyFinancial` text
- [x] Add `lockAmountCurrency` + `lockParty` props to `OrderForm`, wire `disabled` + helper text
- [x] Compute predicates in edit page, pass to form
- [x] Cache invalidation: added `TAG.party(newPartyId)` always + `TAG.party(oldPartyId)` when changed
- [x] Client omits locked fields from PATCH body so unlocked-field edits don't trip 409 guard
- [x] `npm run type-check`
- [ ] Manual smoke (3 scenarios — pending user verification)

## Open questions

1. Should `partyId` change also invalidate the old party's cache tag? (Likely yes; verify against `lib/cache/keys.ts`.)
2. Any audit-log diff customization needed, or does `diffForAudit` already produce a clear before/after for `partyId`? (Spot-check after implementation.)

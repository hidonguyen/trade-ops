# Phase 04 — Transaction expense category (list, filter, form)

## Context Links

- List page: `/Users/hido/trade-ops/app/(dashboard)/transactions/page.tsx`
- Form: `/Users/hido/trade-ops/components/transaction-form.tsx`
- Edit dialog: `/Users/hido/trade-ops/components/transaction-edit-dialog.tsx`
- API: `/Users/hido/trade-ops/app/api/transactions/route.ts`, `/Users/hido/trade-ops/app/api/transactions/[id]/route.ts`
- Validation: `/Users/hido/trade-ops/lib/validation-schemas.ts` (`createStandaloneTransactionSchema`)

## Overview

- Priority: P2
- Status: completed
- Wires `Transaction.expenseTypeId` into standalone transaction CRUD: form input, list column, filter.

## Key Insights

- ExpenseType FK already added in phase 01. Only wiring remains.
- Order-linked transactions (SALE_PAYMENT/PURCHASE_PAYMENT/ADJUSTMENT) do NOT need expenseType — the order owns its own expenseType. Schema stays nullable for both cases.
- Filter behavior consistent with orders list expenseType filter pattern.

## Requirements

**Functional**
- `createStandaloneTransactionSchema` accepts optional `expenseTypeId: z.string().uuid().nullable().optional()`.
- Transaction form (`transaction-form.tsx`) shows a "Loại chi phí" combobox for BOTH RECEIPT and PAYMENT types (seed values apply to both, e.g. "Cọc" used for receipts-from-customer; user can choose).
- Transaction edit dialog mirrors the field.
- Transactions list: new column "Loại chi phí" between "Phương thức" and "Tham chiếu".
- Transactions list: new filter `expenseTypeId` (combobox, same options as order filter).
- GET /api/transactions includes `expenseType` relation in select.
- Filter API: optional `expenseTypeId` query param.

**Non-functional**
- Existing tests pass
- No impact on order-linked transaction endpoints

## Architecture

```
transactions list
  ├─ FilterBar [date, type, paymentMethod, expenseTypeId, bankReference]
  ├─ DataTable columns [..., expenseType.name, ...]
  └─ GET /api/transactions?expenseTypeId=... → Prisma where.expenseTypeId

transaction-form (create)
  └─ Combobox "Loại chi phí" → payload.expenseTypeId
  └─ POST /api/transactions → zod schema validates uuid

transaction-edit-dialog
  └─ same Combobox; PATCH /api/transactions/[id]
```

## Related Code Files

**Modify**
- `/Users/hido/trade-ops/lib/validation-schemas.ts` (standalone create + update)
- `/Users/hido/trade-ops/components/transaction-form.tsx`
- `/Users/hido/trade-ops/components/transaction-edit-dialog.tsx`
- `/Users/hido/trade-ops/app/(dashboard)/transactions/page.tsx`
- `/Users/hido/trade-ops/app/api/transactions/route.ts`
- `/Users/hido/trade-ops/app/api/transactions/[id]/route.ts`

## Implementation Steps

1. **Schemas** — add `expenseTypeId: z.string().uuid().nullable().optional()` to `createStandaloneTransactionSchema` and its update variant.
2. **Form** — add Combobox wired to `/api/expense-types`; handle empty→null mapping on submit.
3. **Edit dialog** — mirror form changes; pre-populate from transaction record.
4. **List filter** — add `expenseTypeId` to `filterConfigs` (select). Options from `/api/expense-types?activeOnly=true`.
5. **List column** — render `row.expenseType?.name ?? "—"`.
6. **List API GET** — parse `expenseTypeId` query; add to `where` clause; include `expenseType: { select: { id, name, isActive } }` in response.
7. **Create API POST** — pass `expenseTypeId` through to `prisma.transaction.create`.
8. **Update API PATCH** — support editing `expenseTypeId` (set null to clear).
9. Compile-check: `npx tsc --noEmit`.

## Todo List

- [ ] Schema updates (create + update)
- [ ] Transaction form Combobox
- [x] Edit dialog Combobox + prefill
- [x] List page filter + column
- [x] API GET: filter + include
- [x] API POST/PATCH: persist field
- [x] Manual test: create PAYMENT tx with "Mua vật tư" → appears in list with that label
- [x] Manual test: filter list by expenseTypeId returns only matching rows

## Success Criteria

- Creating a standalone tx with expenseType persists + renders in list column.
- Filter by expenseType narrows list accurately.
- Editing expenseType updates the field and re-renders list.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Order-linked tx UI accidentally shows the field | L | L | Order payment-form does not import expenseType; isolated to standalone form |
| Filter performance on large tx tables | L | L | `@@index([expenseTypeId])` on Transaction from phase 01 |

## Security Considerations

- Standard RBAC (ACCOUNTANT_CASHFLOW + ADMIN) on standalone tx — no new gates.

## Next Steps / Dependencies

- Unblocks phase 08 (cashflow Excel uses this field to route bank fees + deposits).
- Unblocks phase 09 edge-case testing for transaction list.

# Phase 01 — API: expose fields + DEPOSIT filter

## File
- `app/api/cashflow-report/route.ts`

## Steps

1. **Add `includeDeposit` query param** (default `false`):
   ```ts
   const querySchema = z.object({
     // ...existing
     includeDeposit: z.enum(["true", "false"]).optional(),
   });
   const includeDeposit = parsed.data.includeDeposit === "true";
   ```

2. **Apply filter in `prisma.transaction.findMany.where`**:
   ```ts
   where: {
     businessUnitId,
     transactionDate: { gte: fromDate, lte: toDate },
     ...currencyFilter,
     ...(includeDeposit ? {} : { paymentMethod: { not: "DEPOSIT" } }),
   }
   ```

3. **Extend include**:
   ```ts
   include: {
     currency: { ... },
     businessUnit: { ... },
     order: { select: { orderNumber: true, party: { select: { name: true } } } },
     expenseType: { select: { name: true } },
   }
   ```

4. **Extend `txRows` mapping** with new fields:
   ```ts
   return {
     id, transactionDate, type, paymentType, paymentMethod,
     amountOriginal: tx.amountOriginal.toString(),
     amountVnd: tx.amountVnd.toString(),
     currencyCode: tx.currency.code,           // for Excel back-compat
     currency: tx.currency,
     businessUnit: tx.businessUnit,
     orderNumber: tx.order?.orderNumber ?? null,
     partyName: tx.order?.party?.name ?? null,
     expenseTypeName: tx.expenseType?.name ?? null,
     bankReference: tx.bankReference,
     notes: tx.notes,
     createdBy: tx.createdBy,
     bankFeeOriginal: feeOriginal,
     bankFeeVnd: feeVnd,
   };
   ```

5. **Apply DEPOSIT filter to currency aggregation loop too** — currencyMap is built from same fetched dataset, no extra change needed since prisma already filtered.

## Todo
- [ ] Add includeDeposit param + parsing
- [ ] Wire `paymentMethod: { not: "DEPOSIT" }` conditional
- [ ] Extend include with order/expenseType
- [ ] Add new fields to txRows
- [ ] Compile check

## Success
- `GET /api/cashflow-report?...` (no flag) returns ONLY non-DEPOSIT tx.
- `GET /api/cashflow-report?...&includeDeposit=true` returns all.
- Each tx row has `partyName`, `expenseTypeName`, `orderNumber`, `createdBy`.

## Risks
- **Currency summary now period-filtered correctly**. Previously `computeSummaries` (UI-side) summed all returned tx — still correct after API filter.

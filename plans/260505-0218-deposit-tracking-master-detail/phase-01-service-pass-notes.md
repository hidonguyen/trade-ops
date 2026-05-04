# Phase 01 — Service: pass notes from refund tx

## Files
- `lib/deposit-deduction-service.ts`
- All callers of `createDepositFromRefund` / `upsertOrderTransactionDeposit`

## Steps

1. **Extend `createDepositFromRefund` args** với optional `notes`:
   ```ts
   export async function createDepositFromRefund(
     tx: any,
     args: {
       partyId: string;
       businessUnitId: string;
       currencyId: string;
       amountOriginal: string;
       transactionId: string;
       notes?: string | null;
     }
   ) {
     // ...
     const deposit = await tx.deposit.create({
       data: {
         partyId: args.partyId,
         businessUnitId: args.businessUnitId,
         currencyId: args.currencyId,
         amountOriginal: amount,
         remainingOriginal: amount,
         source: "REFUND",
         notes: args.notes ?? null,
       },
     });
     // ...
   }
   ```

2. **Update orchestrator** (`upsertOrderTransactionDeposit` line ~155):
   ```ts
   await createDepositFromRefund(tx, {
     ...args.partyContext,
     amountOriginal: args.amountOriginal,
     transactionId: args.transactionId,
     notes: args.notes ?? null, // pass refund tx notes through
   });
   ```
   Add `notes` to the function's args interface.

3. **Verify callers** of `upsertOrderTransactionDeposit` — they're tx mutation routes (POST/PATCH). Most already receive `notes` from request body; they pass to tx create. Add the same `notes` to the call site for orchestrator.

4. Compile check.

## Todo
- [ ] Add `notes` to `createDepositFromRefund` args
- [ ] Add `notes` to orchestrator args + propagation
- [ ] Update call sites to pass tx notes
- [ ] Compile check

## Success
- New REFUND-via-refund without existing deposit → Deposit.notes = tx.notes (if provided).
- Existing behavior unchanged when notes is null/undefined.

## Risk
- **Low**: additive optional param.

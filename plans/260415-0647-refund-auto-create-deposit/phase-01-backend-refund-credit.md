# Phase 01 — Backend: credit deposit + auto-create

## Overview
- Priority: Critical
- Status: pending

Extend deposit service + transaction routes so REFUND + DEPOSIT credits (or creates) a deposit.

## Service changes (`lib/deposit-deduction-service.ts`)

Add two new exports; keep `deductDeposit` / `reverseDepositDeduction` for PAYMENT flow.

```ts
// Credit an existing deposit (REFUND + DEPOSIT, user picked existing)
export async function creditDeposit(
  tx: any,
  depositId: string,
  amountOriginal: string,
  transactionId: string
) {
  const amount = new Decimal(amountOriginal);
  await tx.deposit.update({
    where: { id: depositId },
    data: {
      remainingOriginal: { increment: amount },
      // amountOriginal (the original deposit total) also grows when adding credit
      amountOriginal: { increment: amount },
    },
  });
  // DepositUsage signed-negative convention: negative amount = credit.
  // Alternative: add a `kind` column. Keep simple — negative here.
  await tx.depositUsage.create({
    data: { depositId, transactionId, amountOriginal: amount.negated() },
  });
}

// Auto-create a new deposit from a REFUND transaction
export async function createDepositFromRefund(
  tx: any,
  args: {
    partyId: string;
    businessUnitId: string;
    currencyId: string;
    amountOriginal: string;
    transactionId: string;
  }
) {
  const amount = new Decimal(args.amountOriginal);
  const deposit = await tx.deposit.create({
    data: {
      partyId: args.partyId,
      businessUnitId: args.businessUnitId,
      currencyId: args.currencyId,
      amountOriginal: amount,
      remainingOriginal: amount,
    },
  });
  await tx.depositUsage.create({
    data: { depositId: deposit.id, transactionId: args.transactionId, amountOriginal: amount.negated() },
  });
  return deposit;
}
```

### Reverse logic

Update `reverseDepositDeduction` to handle credits (negative usage amounts):
- Negative usage → deposit was credited → reverse = decrement by `abs(amount)` + subtract from `amountOriginal` too.
- If resulting deposit `amountOriginal` would drop to 0 and no other usages remain → **do not auto-delete**; leave as zero-balance record for history.

```ts
for (const usage of usages) {
  const amt = new Decimal(usage.amountOriginal.toString());
  if (amt.isNegative()) {
    // Reverse a credit: decrement both
    const abs = amt.abs();
    await tx.deposit.update({
      where: { id: usage.depositId },
      data: {
        remainingOriginal: { decrement: abs },
        amountOriginal: { decrement: abs },
      },
    });
  } else {
    // Reverse a deduction: increment remaining
    await tx.deposit.update({
      where: { id: usage.depositId },
      data: { remainingOriginal: { increment: amt } },
    });
  }
  await tx.depositUsage.delete({ where: { id: usage.id } });
}
```

## Route changes

### `app/api/orders/[id]/transactions/route.ts` (POST)

Replace current `if (depositId) await deductDeposit(...)` with branch on `paymentType`:

```ts
if (txData.paymentMethod === "DEPOSIT") {
  if (txData.paymentType === "PAYMENT") {
    if (!depositId) throw Error("depositId required");
    await deductDeposit(tx, depositId, txData.amountOriginal, created.id);
  } else { // REFUND
    if (depositId) {
      await creditDeposit(tx, depositId, txData.amountOriginal, created.id);
    } else {
      // Auto-create — partyId comes from order, BU from order
      await createDepositFromRefund(tx, {
        partyId: order.partyId,
        businessUnitId: order.businessUnitId,
        currencyId: txData.currencyId,
        amountOriginal: txData.amountOriginal,
        transactionId: created.id,
      });
    }
  }
}
```

**Note:** current route selects `{ id, type, businessUnitId }` from order — extend to also select `partyId`.

### `app/api/transactions/route.ts` (POST, standalone)

- Require `partyId` in payload when `paymentMethod=DEPOSIT` AND `paymentType=REFUND` AND `depositId` not provided.
- Same branch logic as above using `partyId` from payload + `businessUnitId` from payload.

### Delete routes

`app/api/orders/[id]/transactions/[txId]/route.ts` + `app/api/transactions/[txId]/route.ts`:
- Existing delete calls `reverseDepositDeduction` — now handles both sign conventions. No route change needed.

## Files

- Modify: `lib/deposit-deduction-service.ts`
- Modify: `app/api/orders/[id]/transactions/route.ts`
- Modify: `app/api/transactions/route.ts`

## Steps

1. Add `creditDeposit` + `createDepositFromRefund` exports.
2. Update `reverseDepositDeduction` for signed convention.
3. Update order-tx POST: branch on paymentType.
4. Update standalone-tx POST: branch on paymentType + validate partyId presence.
5. Audit log: creditDeposit / auto-create should appear as audited operations (createAuditLog entries — reuse existing pattern).
6. `npm run type-check`.

## Todo

- [ ] Add `creditDeposit` helper
- [ ] Add `createDepositFromRefund` helper
- [ ] Update `reverseDepositDeduction` for credits
- [ ] Order-tx POST branches on paymentType
- [ ] Standalone-tx POST branches on paymentType + requires partyId for auto-create
- [ ] Audit log entries for new operations
- [ ] Type-check passes

## Success Criteria

- REFUND + DEPOSIT with existing `depositId` → deposit `remainingOriginal` + `amountOriginal` increment.
- REFUND + DEPOSIT with no `depositId` → new Deposit created for (partyId, BU, currency) with balance = refund amount.
- Delete of refund tx reverses the credit/creation.
- PAYMENT + DEPOSIT behavior unchanged.

## Risks

- **Signed DepositUsage convention** is a subtle change. Other code reading `DepositUsage.amountOriginal` may treat it as always-positive. Audit callers (`grep depositUsage.amountOriginal`) before merge.
- **Auto-created deposit with zero usages after reverse** → keep the record; don't auto-delete (simpler, preserves audit trail).
- **Concurrent creates:** two parallel refunds for same party with no deposit → both auto-create. Fine per spec (no dedup required).

## Alternative considered (rejected)

Adding a `kind: 'CREDIT' | 'DEBIT'` column to `DepositUsage` is cleaner than signed amount — but requires a migration and callers update. Signed convention is minimal and reversible.

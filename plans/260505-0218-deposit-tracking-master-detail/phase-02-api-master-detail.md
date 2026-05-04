# Phase 02 — API: master-detail shape + hide seed + sort asc

## File
- `app/api/reports/deposits/route.ts`

## Steps

1. **Replace flat `events` array** với `deposits: DepositMaster[]`:
   ```ts
   interface DepositMaster {
     id: string;
     createdAt: string;
     source: string;            // MANUAL | REFUND
     partyId: string;
     partyName: string;
     partyType: string;
     buCode: string;
     currencyCode: string;
     currencySymbol: string;
     amountOriginal: string;
     remainingOriginal: string;
     notes: string | null;
     usages: Array<{
       id: string;
       createdAt: string;
       amountOriginal: string;   // signed: positive=trừ cọc, negative=hoàn cọc
       eventType: "DEPOSIT_USED" | "DEPOSIT_REFUNDED";
       reference: string | null; // bankReference || tx.notes
     }>;
   }
   ```

2. **Hide-seed logic** trong loop:
   ```ts
   const usages = dep.usages;
   let visibleUsages = usages;
   if (dep.source === "REFUND" && usages.length > 0) {
     const first = usages[0];
     const seedTx = first.transaction;
     const dt = Math.abs(first.createdAt.getTime() - dep.createdAt.getTime());
     const isSeed =
       dt < 5000 &&
       seedTx?.paymentType === "REFUND" &&
       new Decimal(first.amountOriginal.toString()).equals(
         new Decimal(dep.amountOriginal.toString()).negated()
       );
     if (isSeed) visibleUsages = usages.slice(1);
   }
   ```

3. **Map visibleUsages** → detail array:
   ```ts
   const usageRows = visibleUsages.map((u) => {
     const amt = new Decimal(u.amountOriginal.toString());
     return {
       id: u.id,
       createdAt: u.createdAt.toISOString(),
       amountOriginal: amt.abs().toFixed(4),
       eventType: amt.isPositive() ? "DEPOSIT_USED" : "DEPOSIT_REFUNDED",
       reference: u.transaction?.bankReference ?? u.transaction?.notes ?? null,
     };
   });
   ```

4. **Date filter scope**: deposit hiển thị nếu `dep.createdAt` in-period OR ANY visibleUsage in-period. Implement:
   ```ts
   function inRange(d: Date) { /* existing */ }
   const masterIn = inRange(dep.createdAt);
   const filteredUsages = visibleUsages.filter(u => inRange(u.createdAt));
   if (!masterIn && filteredUsages.length === 0) continue;
   // Master shows all visible usages (including out-of-period) when master is in-range,
   // OR shows only in-period usages when master is out-of-range.
   const usagesForMaster = masterIn ? visibleUsages : filteredUsages;
   ```

5. **Sort**: 
   - Deposits asc by `createdAt`.
   - Usages within each deposit asc by `createdAt`.
   - Existing prisma orderBy: `usages.orderBy: { createdAt: "asc" }` (kept). Change `orderBy: { createdAt: "desc" }` for deposits to `"asc"`.

6. **Response**: `apiResponse(true, { deposits: depositMasters })` — wrap in object so future fields can be added.

7. Compile check.

## Todo
- [ ] Define DepositMaster shape
- [ ] Hide seed usage when source=REFUND
- [ ] Map usages with eventType + reference
- [ ] Date filter: master OR usage in-range
- [ ] Sort asc
- [ ] Wrap response in `{ deposits: [...] }`
- [ ] Compile check

## Success
- API returns deposits asc by createdAt.
- REFUND-source deposit doesn't include seed usage.
- Out-of-period deposit with in-period usage still appears (with only in-period usages visible).

## Risk
- **Heuristic miss**: 5s window may miss when deposit + usage created in different transactions due to retry. Mitigation: spot-check via DB query.

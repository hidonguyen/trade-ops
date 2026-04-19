# Phase 01 — Deposit Report API

## Overview
- **Priority:** high
- **Status:** pending
- New API endpoint returning flattened deposit activity timeline

## Related Code Files
- `app/api/reports/deposits/route.ts` — NEW

## API Design

**GET** `/api/reports/deposits`

Query params: `businessUnitId`, `dateFrom`, `dateTo`, `partyId?`, `currencyId?`

Response: flat array of deposit events sorted by date desc.

```ts
interface DepositEvent {
  id: string;           // depositUsage.id or deposit.id (for creation)
  date: string;         // ISO date
  eventType: "DEPOSIT_CREATED" | "DEPOSIT_USED" | "DEPOSIT_REFUNDED";
  amountOriginal: string;  // always positive
  depositId: string;
  remainingAfter: string;  // deposit remaining at time of event
  party: { id: string; name: string };
  currency: { code: string; symbol: string };
  businessUnit: { code: string };
  reference: string | null;  // linked transaction bankReference
}
```

## Implementation

1. Query all deposits matching filters (BU, party, currency)
2. For each deposit, include usages with their linked transactions
3. Flatten into events array:
   - Deposit creation → DEPOSIT_CREATED
   - Usage with positive amount → DEPOSIT_USED (trừ cọc)
   - Usage with negative amount → DEPOSIT_REFUNDED (hoàn cọc)
4. Filter events by date range
5. Sort by date desc
6. RBAC: require GET access to CUSTOMER or SUPPLIER module

## Todo List
- [ ] Create API route
- [ ] Verify compile

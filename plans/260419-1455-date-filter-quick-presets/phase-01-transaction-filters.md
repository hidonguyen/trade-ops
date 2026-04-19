# Phase 01 — Transaction List Filters

## Overview
- **Priority:** high
- **Status:** pending
- Add dateFrom/dateTo + bankReference search to transactions list

## Related Code Files
- `app/api/transactions/route.ts` — add dateFrom, dateTo, bankReference query params
- `app/(dashboard)/transactions/page.tsx` — add filter configs for date range + search

## Implementation Steps

### 1. Backend: Add date + search params to transactions API
File: `app/api/transactions/route.ts`

Add to `where` clause:
```ts
const dateFrom = searchParams.get("dateFrom");
const dateTo = searchParams.get("dateTo");
const bankReference = searchParams.get("bankReference");

const where = {
  orderId: null,
  type: { in: allowedTypes },
  ...(businessUnitId && { businessUnitId }),
  ...(dateFrom && { transactionDate: { gte: new Date(dateFrom) } }),
  ...(dateTo && { transactionDate: { ...where.transactionDate, lte: endOfDay(dateTo) } }),
  ...(bankReference && { bankReference: { contains: bankReference, mode: "insensitive" } }),
};
```

### 2. Frontend: Add filter configs
File: `app/(dashboard)/transactions/page.tsx`

Add to filterConfigs:
- `{ key: "date", label: "Thời gian", type: "date-range" }` 
- `{ key: "bankReference", label: "Tham chiếu", type: "search" }`

Wire dateFrom/dateTo into fetch params.

## Todo List
- [ ] Add date + bankReference params to transactions API
- [ ] Add filter configs to transactions page
- [ ] Verify compile

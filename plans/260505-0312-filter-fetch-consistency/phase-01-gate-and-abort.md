# Phase 01 — Gate initial fetch + AbortController

## Files
- `components/shared/use-persisted-date-range.ts`
- `app/(dashboard)/reports/summary/page.tsx`
- `app/(dashboard)/reports/cashflow/page.tsx`
- `app/(dashboard)/reports/deposits/page.tsx`
- `app/(dashboard)/reports/bank-fees/page.tsx`
- `app/(dashboard)/orders/page.tsx`
- `app/(dashboard)/transactions/page.tsx`
- `app/(dashboard)/parties/page.tsx`
- `app/(dashboard)/settings/audit-logs/page.tsx`

> Lưu ý: orders/transactions/parties/audit-logs có thể chưa dùng `useRestorePersistedDateRange`. Với những trang đó, chỉ áp dụng AbortController + gate trên `buLoaded`/`selectedBuId` (bỏ qua `dateRestored` flag).

## Root cause recap

Trong mỗi page:
```tsx
const [filters, setFilters] = useState(() => ({ ...getInitialDateRange("...") }));
useRestorePersistedDateRange("...", (range) => setFilters((p) => ({ ...p, ...range })));
const fetchReport = useCallback(async () => { ... }, [filters, selectedBuId, buLoaded, ...]);
useEffect(() => { fetchReport(); }, [fetchReport]);
```

→ 2-3 fetch tuần tự khi mount, không abort response cũ.

## Steps

### A. Add `restored` flag to `useRestorePersistedDateRange`

Sửa `components/shared/use-persisted-date-range.ts`:
```ts
export function useRestorePersistedDateRange(
  pageKey: string,
  applyRange: (range: DateRange) => void,
): boolean {
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const persisted = readPersistedDateRange(pageKey);
    if (persisted) applyRange(persisted);
    setRestored(true);  // signal: ready to fetch
  }, [pageKey]);
  return restored;
}
```

### B. Gate fetchReport on `restored && buLoaded && selectedBuId`

Mỗi page:
```tsx
const dateRestored = useRestorePersistedDateRange("deposits", (range) => setFilters((p) => ({ ...p, ...range })));

const fetchReport = useCallback(async (signal?: AbortSignal) => {
  if (!buLoaded || !selectedBuId || !dateRestored) return;
  setLoading(true);
  try {
    const res = await fetch(url, { signal });
    if (signal?.aborted) return;
    const json = await res.json();
    if (json.success) setDeposits(json.data?.deposits ?? []);
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    console.error(err);
  } finally {
    if (!signal?.aborted) setLoading(false);
  }
}, [filters, selectedBuId, buLoaded, hideDepleted, dateRestored]);

useEffect(() => {
  const ctrl = new AbortController();
  fetchReport(ctrl.signal);
  return () => ctrl.abort();
}, [fetchReport]);
```

### C. Verify

- Vào trang có persisted range → DevTools Network: chỉ 1 request `reports/...`.
- Đổi filter rapid 3 lần liên tiếp → response cũ trạng thái "cancelled" trong Network.
- Smoke test 4 trang reports.

## Todo
- [ ] Sửa `use-persisted-date-range.ts` trả `restored: boolean`
- [ ] Apply gate + AbortController cho `summary/page.tsx`
- [ ] Apply gate + AbortController cho `cashflow/page.tsx`
- [ ] Apply gate + AbortController cho `deposits/page.tsx`
- [ ] Apply gate + AbortController cho `bank-fees/page.tsx`
- [ ] AbortController cho `orders/page.tsx`
- [ ] AbortController cho `transactions/page.tsx`
- [ ] AbortController cho `parties/page.tsx`
- [ ] AbortController cho `settings/audit-logs/page.tsx`
- [ ] Compile check
- [ ] Network smoke test 8 trang

## Success
- Mount: đúng 1 request.
- Rapid filter change: chỉ 1 response landed (last wins, others aborted).

## Risk
- **Hook signature đổi**: `useRestorePersistedDateRange` giờ trả boolean. Caller chưa đọc giá trị thì không break. Nhưng nếu page khác dùng và bỏ qua return value → vẫn OK (TS không complain).
- **Stale closure** trong abort: dùng cleanup function trong useEffect — chuẩn React idiom, an toàn.

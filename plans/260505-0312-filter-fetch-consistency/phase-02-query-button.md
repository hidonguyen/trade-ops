# Phase 02 — Manual "Truy vấn" button

## Files
- `components/shared/filter-bar.tsx` (add optional `onSubmit` prop)
- 4 reports: `summary`, `cashflow`, `deposits`, `bank-fees`
- 4 list pages: `orders`, `transactions`, `parties`, `settings/audit-logs`

## Goal

Sau Phase 1 fetch đã ổn, nhưng user vẫn không muốn đổi filter là call API ngay. Thêm nút "Truy vấn" để fetch chỉ khi click. Initial fetch (Phase 1) vẫn auto sau khi gating ready.

## Steps

### A. FilterBar — add `onSubmit`

```tsx
interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onSubmit?: () => void;  // NEW: nếu set, hiện nút "Truy vấn"
}
```

Render: nếu `onSubmit` → append button cuối hàng filters:
```tsx
{onSubmit && (
  <Button size="sm" onClick={onSubmit}>
    <SearchIcon className="size-4 mr-1.5" /> Truy vấn
  </Button>
)}
```

Backwards-compat: page không pass `onSubmit` (orders, transactions, parties, audit-logs) → không hiện nút, behavior không đổi.

### B. Tách filter state thành "draft" và "applied"

Mỗi report page:
```tsx
const [draftFilters, setDraftFilters] = useState(...);
const [appliedFilters, setAppliedFilters] = useState(draftFilters);

// fetch chỉ phụ thuộc appliedFilters
const fetchReport = useCallback(async (signal) => {
  // dùng appliedFilters thay vì filters
}, [appliedFilters, ...]);

// FilterBar bind vào draft
<FilterBar
  values={draftFilters}
  onFilterChange={(k, v) => setDraftFilters((p) => ({ ...p, [k]: v }))}
  onSubmit={() => setAppliedFilters(draftFilters)}
  ... />
```

**Initial sync**: khi `useRestorePersistedDateRange` apply, set CẢ draft và applied:
```tsx
const dateRestored = useRestorePersistedDateRange("deposits", (range) => {
  setDraftFilters((p) => ({ ...p, ...range }));
  setAppliedFilters((p) => ({ ...p, ...range }));
});
```

**DateQuickPresets**: vẫn auto-apply (tiện UX) — set cả draft + applied khi click preset.

**hideDepleted toggle (deposits)**: là toggle trực tiếp, không qua FilterBar → lựa chọn:
- (a) Cũng yêu cầu click Truy vấn (nhất quán)
- (b) Toggle auto-fetch ngay (nhanh)
- → Recommend (a) cho nhất quán: chuyển hideDepleted vào draft state.

### C. Verify

- Đổi 1 filter → không có request mới.
- Click "Truy vấn" → 1 request với filters đã đổi.
- Click DateQuickPreset → request fire ngay.
- Persisted range vẫn apply lần đầu, fetch 1 lần.

## Todo
- [ ] FilterBar: thêm prop `onSubmit` + render button có điều kiện
- [ ] Tách draft/applied state cho 4 trang reports
- [ ] Tách draft/applied state cho 4 trang list (orders, transactions, parties, audit-logs)
- [ ] DateQuickPresets: set cả draft + applied
- [ ] hideDepleted (deposits): đưa vào draft, áp dụng khi click Truy vấn
- [ ] Server-side pagination: reset page=1 khi click Truy vấn (orders/transactions cashflow)
- [ ] `usePersistDateRange` chỉ ghi từ `appliedFilters.dateFrom/dateTo`, KHÔNG ghi từ draft
- [ ] Compile check
- [ ] Smoke test 8 trang

## Success
- Đổi filter → không call API.
- Click Truy vấn → call 1 lần với filters hiện tại.
- Quick-presets vẫn fetch ngay.

## Risk
- **Confused user**: thấy filter đổi nhưng bảng chưa update. Mitigation: nút "Truy vấn" rõ ràng, có thể disable khi `draft === applied` để hint.
- **Persistance vs draft**: persist từ `appliedFilters` (đã commit qua nút Truy vấn) — không ghi khi user mới gõ filter mà chưa apply.
- **Pagination state**: list pages có `page`/`pageSize`. Đổi filter mà không click Truy vấn → page state vẫn cũ. Khi click Truy vấn phải reset `page=1` để tránh "page out of range".

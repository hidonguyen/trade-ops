# Phase 04 — UI: handle row discriminator + new labels

## Context Links
- File: `app/(dashboard)/reports/summary/page.tsx` (300 lines)
- Phase 02 defines the JSON shape

## Overview
- Priority: P2
- Status: pending (blocked by Phase 02)
- Update standalone-tab columns to render `rowType`-aware rows. Customer order tab needs no UI change (column meanings unchanged; values arrive net from API).

## Key Insights
- Single `STANDALONE_COLUMNS` definition handles all 3 row types via the `label` field replacing the now-unused inline rendering of paymentMethod-only.
- `paymentMethod` is null for deposit rows — render as "Cọc" or "—".
- File at 300 lines; modularize if it crosses 350 (extract column defs into `summary-columns.ts`).

## Requirements
- Functional: Thu khác/Chi khác show all merged rows correctly labeled. Order tabs unchanged visually.
- Non-functional: no client-side filtering of rowType (server already merges/sorts).

## Files to Modify
- `app/(dashboard)/reports/summary/page.tsx`

## Implementation Steps

1. **Update `StandaloneRow` interface** (line 28-37) to match Phase 02 shape:
   ```ts
   interface StandaloneRow extends Record<string, unknown> {
     rowType: "transaction" | "deposit" | "bankFee";
     id: string;
     date: string;             // renamed from transactionDate
     amountOriginal: string;
     currencyCode: string;
     currencySymbol: string;
     paymentMethod: string | null;
     bankReference: string | null;
     partyName: string | null;
     label: string;
     notes: string | null;
   }
   ```

2. **Update `STANDALONE_COLUMNS`** (line 112-150):
   - Replace `transactionDate` key with `date`.
   - Add new "Đối tác" column between date and amount, render `partyName ?? "—"`.
   - Add new "Loại" column showing the row label (e.g., "Đặt cọc khách hàng", "Phí ngân hàng — {party} {order}", or expense type for plain transactions). Source: `label`.
   - `paymentMethod` render: `v === null ? "—" : v === "BANK" ? "Ngân hàng" : "Cọc"`.
   - Optional: badge color for `rowType==="bankFee"` (red text) and `rowType==="deposit"` (blue text) on the Loại column.

   Final column order:
   ```
   STT | Ngày | Đối tác | Số tiền | Tiền tệ | Loại | Phương thức | Tham chiếu | Ghi chú
   ```

3. **CSV export columns** (line 152-163, plus call site line 270-273) — re-derive from updated `STANDALONE_COLUMNS` (already filters `key !== "index"`). No structural change needed; verify the CSV header includes new columns.

4. **No change** to `ORDER_COLUMNS`, `TABS`, `fetchSummary`. Customer "TT lần này" already comes net from API.

5. **Compile check**: `npm run build`.

6. **Visual smoke**: load page with seeded data, confirm Thu khác shows manual deposit rows with party + "Đặt cọc khách hàng" label, Chi khác shows fee rows with red label.

7. **If file exceeds 200 lines after edits** (likely will, currently 300) — extract column defs into `app/(dashboard)/reports/summary/summary-columns.tsx`. Acceptable since file is already over budget; do extraction as part of this phase.

## Todo List
- [ ] Update `StandaloneRow` interface with `rowType`, `partyName`, `label`, renamed `date`
- [ ] Rewrite `STANDALONE_COLUMNS` with new columns (Đối tác, Loại) and null-safe paymentMethod
- [ ] Verify CSV export still works (auto-derived from columns)
- [ ] Optional: color-code bankFee vs deposit rows
- [ ] Extract columns to `summary-columns.tsx` if file > 200 lines
- [ ] Compile check
- [ ] Smoke test all 4 tabs

## Success Criteria
- Thu khác lists standalone receipts + manual customer deposits with correct labels.
- Chi khác lists standalone payments + manual supplier deposits + bank-fee rows.
- Order tabs render as before; "TT lần này" reflects net amount.
- CSV export contains the new columns.
- No console errors, no TS errors.

## Risk Assessment
- **Stale persisted state (Low/Low)**: existing `dateFrom/dateTo` persistence unaffected by row-shape change.
- **Column overflow on small screens (Med/Low)**: 9 columns may scroll horizontally. Mitigation: `DataTable` already handles overflow.

## Security Considerations
- Read-only page. No new data exposure beyond existing access (`checkAccess(GET, DASHBOARD)` enforced server-side).

## Next Steps
- Manual QA with finance user to validate labels and Vietnamese terminology.
- Consider follow-up: client-side filter chips by `rowType` (deferred — YAGNI).

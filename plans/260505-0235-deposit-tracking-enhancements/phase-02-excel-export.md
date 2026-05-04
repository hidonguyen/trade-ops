# Phase 02 — Excel export

## Files (new)
- `app/api/reports/deposits/export/route.ts`
- `lib/excel-deposit-tracking-service.ts`

## File (modified)
- `app/(dashboard)/reports/deposits/page.tsx` (add export button)

## Steps

### A. Excel service
Build a flat single-sheet xls. Each Deposit master row, then indented detail rows.

```ts
// lib/excel-deposit-tracking-service.ts
import ExcelJS from "exceljs";
import { applyHeaderStyle, formatDateDdMmYyyy, buildReportFilename } from "./excel-report-utils";

interface DepositMasterExport {
  createdAt: Date | string;
  source: string;
  partyName: string;
  buCode: string;
  currencyCode: string;
  amountOriginal: number;
  remainingOriginal: number;
  notes: string | null;
  usages: Array<{
    createdAt: Date | string;
    eventType: "DEPOSIT_USED" | "DEPOSIT_REFUNDED";
    amountOriginal: number;
    reference: string | null;
  }>;
}

export async function exportDepositTracking(deposits: DepositMasterExport[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Trade Ops";
  wb.created = new Date();
  const sheet = wb.addWorksheet("Theo dõi cọc");
  sheet.columns = [
    { header: "Ngày", key: "date", width: 14 },
    { header: "Loại", key: "kind", width: 18 },
    { header: "Đối tác", key: "party", width: 24 },
    { header: "Đơn vị", key: "bu", width: 8 },
    { header: "Tiền tệ", key: "ccy", width: 10 },
    { header: "Số tiền", key: "amount", width: 18 },
    { header: "Số dư", key: "remaining", width: 18 },
    { header: "Tham chiếu / Ghi chú", key: "ref", width: 30 },
  ];
  applyHeaderStyle(sheet.getRow(1));

  for (const d of deposits) {
    const dateStr = formatDateDdMmYyyy(d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt));
    const masterRow = sheet.addRow({
      date: dateStr,
      kind: d.source === "REFUND" ? "Hoàn từ GD" : "Đặt cọc",
      party: d.partyName,
      bu: d.buCode,
      ccy: d.currencyCode,
      amount: d.amountOriginal,
      remaining: d.remainingOriginal,
      ref: d.notes ?? "",
    });
    masterRow.font = { bold: true };
    masterRow.getCell("amount").numFmt = "#,##0";
    masterRow.getCell("remaining").numFmt = "#,##0";

    for (const u of d.usages) {
      const uDate = formatDateDdMmYyyy(u.createdAt instanceof Date ? u.createdAt : new Date(u.createdAt));
      const uRow = sheet.addRow({
        date: `  ↳ ${uDate}`,
        kind: u.eventType === "DEPOSIT_USED" ? "Trừ cọc" : "Hoàn cọc",
        party: "",
        bu: "",
        ccy: d.currencyCode,
        amount: u.eventType === "DEPOSIT_USED" ? -u.amountOriginal : u.amountOriginal,
        remaining: "",
        ref: u.reference ?? "",
      });
      uRow.getCell("amount").numFmt = "#,##0";
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function buildDepositTrackingFilename(): string {
  return buildReportFilename("theo-doi-coc", new Date(), new Date());
}
```

### B. Export route
```ts
// app/api/reports/deposits/export/route.ts
// Reuses the same query → call internal data fetch logic. Cleanest: refactor
// the JSON route's inner function into a shared helper. KISS approach: copy
// the logic for now (acceptable per YAGNI; revisit if 3rd consumer appears).
```

Simpler path: in `app/api/reports/deposits/route.ts`, accept `format=xlsx` query param. When `xlsx`, after building `masters`, call `exportDepositTracking()` and return as Excel response. Avoid second route.

### C. UI button
Add in page header next to title:
```tsx
<Button variant="outline" size="sm" onClick={handleExportExcel}>
  <DownloadIcon className="size-4 mr-1.5" /> Xuất Excel
</Button>
```
`handleExportExcel` opens `/api/reports/deposits?...&format=xlsx` in new tab.

### D. API param
Extend query schema to accept optional `format=json|xlsx` (default json).

## Todo
- [ ] Create `lib/excel-deposit-tracking-service.ts`
- [ ] Add `format` param to API + xlsx branch
- [ ] Add export button + handler in UI
- [ ] Compile check
- [ ] Smoke test export — eyeball master/detail row layout

## Success
- Click "Xuất Excel" → tải `.xlsx`.
- File chứa header row + master rows (bold) interleaved with indented detail rows.
- Filter (`hideDepleted`, date, party, currency) applied to export same as JSON.

## Risk
- **excel-report-utils signature**: verify `buildReportFilename` accepts (slug, from, to). If not, simplify to literal filename.

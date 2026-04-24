# Phase 05 — Excel common utilities

## Context Links

- Existing: `/Users/hido/trade-ops/lib/excel-export-service.ts`
- Spec: §5 of `/Users/hido/trade-ops/tradeops-report-adjustment-prompt.md`

## Overview

- Priority: P1
- Status: completed
- Extracts shared exceljs helpers used by sales/purchase/cashflow report exports to avoid duplication.

## Key Insights

- Existing `excel-export-service.ts` has inline `styleHeaderRow`. Extract + extend to cover subtotal rows, grand total rows, title merge, date/number formats.
- No formulas per spec — all values precomputed server-side.
- Filename convention: `bao-cao-{loai}-{yyyyMMdd}-{yyyyMMdd}.xlsx`.
- KISS: a single new utility module with pure functions; no class abstractions.

## Requirements

**Functional**
- Styled header row (bold, center, light gray bg).
- Styled subtotal row (light yellow bg, bold).
- Styled grand-total row (gray bg, bold).
- Title merge row (row 1 merges N cells; centered, bold).
- Date-range subtitle row (row 2).
- Number format `#,##0` application for amount columns.
- Date format `dd/MM/yyyy` application.
- Filename builder: `buildReportFilename(kind, from, to)` → `bao-cao-{kind}-{YYYYMMDD}-{YYYYMMDD}.xlsx`.
- Helper to add an empty blank row between groups.

**Non-functional**
- Pure functions, no hidden state
- Zero dep beyond exceljs (already in stack)
- Keep file <200 LOC

## Architecture

```
lib/excel-report-utils.ts (new)
  exports:
    applyHeaderStyle(row)
    applySubtotalStyle(row)
    applyGrandTotalStyle(row)
    addTitleRow(sheet, text, colCount)
    addDateRangeRow(sheet, from, to, colCount)
    applyNumberFormat(column, format = "#,##0")
    applyDateFormat(column)
    formatDateDdMmYyyy(date)  // for .addRow({ col: formatted })
    buildReportFilename(kind, from, to)
    addBlankRow(sheet)
```

## Related Code Files

**Create**
- `/Users/hido/trade-ops/lib/excel-report-utils.ts` (~150 LOC)

**Modify (refactor existing users to consume utils)**
- `/Users/hido/trade-ops/lib/excel-export-service.ts` — replace inline `styleHeaderRow` with imported `applyHeaderStyle`. Leave rest untouched to minimize blast radius.

## Implementation Steps

1. Create `lib/excel-report-utils.ts` with the functions listed in Architecture.
2. Style constants (colors, font sizes) at top of file.
3. Title merge helper: `sheet.mergeCells(1, 1, 1, colCount); sheet.getCell(1,1).value = title; sheet.getCell(1,1).alignment = { horizontal: "center" }; sheet.getCell(1,1).font = { bold: true, size: 14 };`.
4. Date-range subtitle helper at row 2 (not merged by default; caller can merge if needed).
5. Export a single `STYLES` object for color constants (header gray `FFD3D3D3`, subtotal yellow `FFFFF2CC`, grand-total gray-darker `FFB0B0B0`) for DRY reuse.
6. Number-format helper: iterate rows via `column.numFmt = "#,##0"` (applies to column style).
7. Filename helper uses `date-fns/format` if available; else simple template literal with pad-zero.
8. Refactor `excel-export-service.ts` to import `applyHeaderStyle` (drops local helper). Verify `npx tsc --noEmit`.
9. No new migration, no route change — utilities only.

## Todo List

- [x] Create `lib/excel-report-utils.ts`
- [x] Define STYLES constants
- [x] Implement header/subtotal/grand-total style functions
- [x] Implement title row + date-range row helpers
- [x] Implement number + date format helpers
- [x] Implement `buildReportFilename`
- [x] Refactor `excel-export-service.ts` to use `applyHeaderStyle`
- [ ] tsc clean
- [ ] Unit-test filename builder + format helpers manually (node REPL or smoke test)

## Success Criteria

- All four new export services in phases 06–08 consume these utilities without duplicating styling logic.
- File <200 LOC.
- No breakage in existing bank-fee/cashflow/orders Excel exports.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Refactor breaks existing bank-fee export | L | M | Minimal refactor — only swap `styleHeaderRow` call |
| exceljs API differences between local vs server version | L | L | Pin exceljs already in package.json |
| Number format incompatible with Libre/Google Sheets | L | L | `#,##0` is lowest-common-denominator format |

## Security Considerations

- None (pure utility module).

## Next Steps / Dependencies

- Unblocks phases 06, 07, 08.

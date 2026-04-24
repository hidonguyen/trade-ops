// Shared ExcelJS helpers for all Trade Ops report exports
// Pure functions — no hidden state, no class abstractions
import ExcelJS from "exceljs";
import { format as dateFnsFormat } from "date-fns";

// ─── Colour constants ────────────────────────────────────────────────────────

export const STYLES = {
  /** Light gray — used for header rows */
  headerGray: "FFD3D3D3",
  /** Light yellow — used for subtotal rows */
  subtotalYellow: "FFFFF2CC",
  /** Darker gray — used for grand-total rows */
  grandTotalGray: "FFB0B0B0",
} as const;

// ─── Row-level styling ───────────────────────────────────────────────────────

/** Bold, centered, light-gray background — use for column header rows */
export function applyHeaderStyle(row: ExcelJS.Row): void {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: STYLES.headerGray },
  };
  row.alignment = { horizontal: "center" };
}

/** Bold, light-yellow background — use for currency / group subtotal rows */
export function applySubtotalStyle(row: ExcelJS.Row): void {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: STYLES.subtotalYellow },
  };
}

/** Bold, darker-gray background — use for grand-total rows */
export function applyGrandTotalStyle(row: ExcelJS.Row): void {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: STYLES.grandTotalGray },
  };
}

// ─── Sheet-level structure helpers ──────────────────────────────────────────

/**
 * Adds and styles row 1 as a merged title banner.
 * Must be called BEFORE adding column headers so row numbers stay consistent.
 */
export function addTitleRow(
  sheet: ExcelJS.Worksheet,
  text: string,
  colCount: number
): void {
  const row = sheet.getRow(1);
  row.getCell(1).value = text;
  sheet.mergeCells(1, 1, 1, colCount);
  row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  row.getCell(1).font = { bold: true, size: 14 };
  row.height = 24;
  row.commit();
}

/**
 * Adds row 2 as a "Date range: {from} – {to}" subtitle.
 * Optionally merges across colCount columns if provided.
 */
export function addDateRangeRow(
  sheet: ExcelJS.Worksheet,
  from: Date,
  to: Date,
  colCount?: number
): void {
  const fromStr = formatDateDdMmYyyy(from);
  const toStr = formatDateDdMmYyyy(to);
  const row = sheet.getRow(2);
  row.getCell(1).value = `Từ ngày ${fromStr} đến ngày ${toStr}`;
  if (colCount && colCount > 1) {
    sheet.mergeCells(2, 1, 2, colCount);
  }
  row.getCell(1).alignment = { horizontal: "center" };
  row.getCell(1).font = { italic: true, size: 11 };
  row.commit();
}

/** Inserts an empty spacer row at the next available row index */
export function addBlankRow(sheet: ExcelJS.Worksheet): void {
  sheet.addRow([]);
}

// ─── Column-level format helpers ─────────────────────────────────────────────

/**
 * Applies a number format to an ExcelJS column.
 * Defaults to `#,##0` (integer thousands-separator, no decimals).
 */
export function applyNumberFormat(
  column: ExcelJS.Column,
  fmt = "#,##0"
): void {
  column.numFmt = fmt;
}

/** Applies `dd/MM/yyyy` date format to an ExcelJS column */
export function applyDateFormat(column: ExcelJS.Column): void {
  column.numFmt = "dd/MM/yyyy";
}

// ─── Value formatters (for use in addRow data objects) ───────────────────────

/** Returns a `dd/MM/yyyy` formatted string from a Date */
export function formatDateDdMmYyyy(date: Date): string {
  return dateFnsFormat(date, "dd/MM/yyyy");
}

// ─── Filename builder ────────────────────────────────────────────────────────

/**
 * Returns a standardised report filename.
 * Pattern: `bao-cao-{kind}-{YYYYMMDD}-{YYYYMMDD}.xlsx`
 *
 * @example buildReportFilename("dieu-chinh", from, to)
 *   → "bao-cao-dieu-chinh-20260101-20260131.xlsx"
 */
export function buildReportFilename(
  kind: string,
  from: Date,
  to: Date
): string {
  const fmt = (d: Date) => dateFnsFormat(d, "yyyyMMdd");
  return `bao-cao-${kind}-${fmt(from)}-${fmt(to)}.xlsx`;
}

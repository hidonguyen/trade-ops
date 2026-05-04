// Cashflow summary Excel — section renderers (helpers split for modularisation)
import ExcelJS from "exceljs";
import {
  applyHeaderStyle,
  formatDateDdMmYyyy,
} from "./excel-report-utils";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface OrderCashflowRow {
  partyName: string;
  orderNumber: string;
  paymentDate: Date;         // actual tx date
  currencyCode: string;
  debtBefore: number;        // Nợ cũ (nguyên tệ)
  paidThisTime: number;      // TT lần này (nguyên tệ)
  debtRemaining: number;     // Nợ còn lại (nguyên tệ)
  vndAmount: number;         // Quy đổi VNĐ
  notes?: string | null;
}

export interface OtherCashflowRow {
  transactionDate: Date;
  payerReceiver: string;     // blank for bank-fee rows
  description: string;       // Nội dung/Diễn giải
  paymentMethod: string;     // PTTT (e.g. Ngân hàng, Cọc, …)
  referenceCode: string;
  currencyCode: string;
  originalAmount: number;
  vndAmount: number;
  notes?: string | null;
}

export interface BuSection {
  buCode: string;
  buName?: string | null;
  customerReceipts: OrderCashflowRow[];   // III.a
  otherReceipts: OtherCashflowRow[];      // III.b
  supplierPayments: OrderCashflowRow[];   // IV.a
  otherPayments: OtherCashflowRow[];      // IV.b
}

// ─── Column definitions ───────────────────────────────────────────────────────

/** 10-column spec for a / b sections */
const SECTION_A_COLS = [
  "STT", "Đối tác", "Mã ĐH", "Ngày", "Tiền tệ",
  "Nợ cũ (nguyên tệ)", "TT lần này (nguyên tệ)", "Nợ còn lại (nguyên tệ)",
  "Quy đổi VNĐ", "Ghi chú",
];

const SECTION_B_COLS = [
  "STT", "Ngày phát sinh", "Người nộp/nhận", "Nội dung",
  "PTTT", "Mã tham chiếu", "Tiền tệ", "Nguyên tệ",
  "Quy đổi VNĐ", "Ghi chú",
];

const NUM_COLS = 10; // both a and b have 10 columns

// Amount columns (1-based) for section a: cols 6,7,8,9
const A_AMOUNT_COLS = [6, 7, 8, 9];
// Amount columns for section b: cols 8,9
const B_AMOUNT_COLS = [8, 9];

// ─── Style helpers ────────────────────────────────────────────────────────────

/** Merged section-level heading row (e.g. "III. Các khoản phải thu") */
export function addSectionHeading(sheet: ExcelJS.Worksheet, text: string): void {
  const row = sheet.addRow([text]);
  sheet.mergeCells(row.number, 1, row.number, NUM_COLS);
  row.getCell(1).font = { bold: true, size: 13 };
  row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  row.height = 20;
  row.commit();
}

/** Merged BU subheading row (e.g. "1. TK") */
export function addBuHeading(sheet: ExcelJS.Worksheet, buCode: string): void {
  const row = sheet.addRow([`1. ${buCode}`]);
  sheet.mergeCells(row.number, 1, row.number, NUM_COLS);
  row.getCell(1).font = { bold: true, size: 12 };
  row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  row.height = 18;
  row.commit();
}

/** Merged subsection heading (e.g. "a. Thu từ khách hàng") */
function addSubsectionHeading(sheet: ExcelJS.Worksheet, text: string): void {
  const row = sheet.addRow([text]);
  sheet.mergeCells(row.number, 1, row.number, NUM_COLS);
  row.getCell(1).font = { bold: true, size: 11 };
  row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  row.height = 16;
  row.commit();
}

/** Column-header row for a section */
function addColHeaderRow(sheet: ExcelJS.Worksheet, cols: string[]): void {
  const row = sheet.addRow(cols);
  applyHeaderStyle(row);
  row.height = 15;
  row.commit();
}


// ─── Section renderers ────────────────────────────────────────────────────────

/** Render section a (order-level rows: III.a or IV.a) */
export function renderSectionA(
  sheet: ExcelJS.Worksheet,
  label: string,
  rows: OrderCashflowRow[]
): void {
  if (rows.length === 0) return;

  addSubsectionHeading(sheet, label);
  addColHeaderRow(sheet, SECTION_A_COLS);

  rows.forEach((r, i) => {
    const rowData: (string | number | Date)[] = [
      i + 1,
      r.partyName,
      r.orderNumber,
      formatDateDdMmYyyy(r.paymentDate),
      r.currencyCode,
      r.debtBefore,
      r.paidThisTime,
      r.debtRemaining,
      r.vndAmount,
      r.notes ?? "",
    ];
    const exRow = sheet.addRow(rowData);
    // Format amount columns
    for (const col of A_AMOUNT_COLS) {
      exRow.getCell(col).numFmt = "#,##0";
    }
    exRow.commit();
  });
}

/** Render section b (standalone rows: III.b or IV.b) — flat list, no sub-grouping */
export function renderSectionB(
  sheet: ExcelJS.Worksheet,
  label: string,
  rows: OtherCashflowRow[]
): void {
  if (rows.length === 0) return;

  addSubsectionHeading(sheet, label);
  addColHeaderRow(sheet, SECTION_B_COLS);

  rows.forEach((r, i) => {
    const rowData: (string | number | Date)[] = [
      i + 1,
      formatDateDdMmYyyy(r.transactionDate),
      r.payerReceiver,
      r.description,
      r.paymentMethod,
      r.referenceCode,
      r.currencyCode,
      r.originalAmount,
      r.vndAmount,
      r.notes ?? "",
    ];
    const exRow = sheet.addRow(rowData);
    for (const col of B_AMOUNT_COLS) {
      exRow.getCell(col).numFmt = "#,##0";
    }
    exRow.commit();
  });
}

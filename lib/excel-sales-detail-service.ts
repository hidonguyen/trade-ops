// Excel detail export for SALE (13 cols) and PURCHASE (14 cols) orders
// Payment rows + Total row per order; blank row between orders; grand totals by currency.
// Companion to excel-order-reports-service.ts (summary export).
import ExcelJS from "exceljs";
import Decimal from "decimal.js";
import {
  addTitleRow,
  addDateRangeRow,
  addBlankRow,
  applyHeaderStyle,
  applySubtotalStyle,
  applyGrandTotalStyle,
  applyNumberFormat,
  formatDateDdMmYyyy,
} from "./excel-report-utils";
import {
  SaleOrderForExport,
  PurchaseOrderForExport,
  getStatusLabel,
} from "./excel-order-reports-helpers";

// ─── Column headers ──────────────────────────────────────────────────────────

const SALE_DETAIL_HEADERS = [
  "ĐƠN VỊ",             // col 1
  "ĐỐI TÁC",            // col 2
  "SỐ ĐƠN",             // col 3
  "NGÀY ĐƠN HÀNG",      // col 4
  "TIỀN TỆ",            // col 5
  "GIÁ TRỊ ĐH",         // col 6
  "ĐIỀU CHỈNH GIÁ TRỊ ĐH", // col 7 (tăng: dương, giảm: âm)
  "HẠN TT",             // col 8
  "NGÀY TT",            // col 9
  "THANH TOÁN LẦN NÀY", // col 10
  "CÒN PHẢI TT",        // col 11
  "TRẠNG THÁI",         // col 12
  "NGƯỜI NỘP/NHẬN",     // col 13 — populated only on tx rows
  "GHI CHÚ",            // col 14
];

// PURCHASE: inserts LOẠI CHI PHÍ at col 14; GHI CHÚ shifts to col 15
const PURCHASE_DETAIL_HEADERS = [
  "ĐƠN VỊ",             // col 1
  "ĐỐI TÁC",            // col 2
  "SỐ ĐƠN",             // col 3
  "NGÀY ĐƠN HÀNG",      // col 4
  "TIỀN TỆ",            // col 5
  "GIÁ TRỊ ĐH",         // col 6
  "ĐIỀU CHỈNH GIÁ TRỊ ĐH", // col 7 (tăng: dương, giảm: âm)
  "HẠN TT",             // col 8
  "NGÀY TT",            // col 9
  "THANH TOÁN LẦN NÀY", // col 10
  "CÒN PHẢI TT",        // col 11
  "TRẠNG THÁI",         // col 12
  "NGƯỜI NỘP/NHẬN",     // col 13 — populated only on tx rows
  "LOẠI CHI PHÍ",       // col 14 — purchase-specific
  "GHI CHÚ",            // col 15
];

// Base column widths shared between SALE (14 cols) and PURCHASE (15 cols).
// Includes width for NGƯỜI NỘP/NHẬN (col 13).
const BASE_WIDTHS = [10, 22, 16, 14, 8, 16, 16, 14, 14, 18, 16, 14, 22];

// ─── Shared workbook builder ─────────────────────────────────────────────────

type DetailType = "SALE" | "PURCHASE";

/**
 * Build detail workbook for SALE (13 cols) or PURCHASE (14 cols).
 * PURCHASE inserts LOẠI CHI PHÍ at col 13 (shown on Total row; blank on payment rows).
 */
async function buildDetailWorkbook(
  data: SaleOrderForExport[],
  dateFrom: Date,
  dateTo: Date,
  type: DetailType
): Promise<Buffer> {
  const isPurchase = type === "PURCHASE";
  const colCount = isPurchase ? 15 : 14;
  const headers = isPurchase ? PURCHASE_DETAIL_HEADERS : SALE_DETAIL_HEADERS;
  // PURCHASE adds expenseType col (width 20) between NGƯỜI NỘP/NHẬN and GHI CHÚ
  const colWidths = isPurchase ? [...BASE_WIDTHS, 20, 24] : [...BASE_WIDTHS, 24];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Trade Ops";
  workbook.created = new Date();

  const sheetName = isPurchase ? "Chi tiết mua hàng" : "Chi tiết bán hàng";
  const title = isPurchase ? "BÁO CÁO CHI TIẾT MUA HÀNG" : "BÁO CÁO CHI TIẾT BÁN HÀNG";
  const sheet = workbook.addWorksheet(sheetName);

  addTitleRow(sheet, title, colCount);
  addDateRangeRow(sheet, dateFrom, dateTo, colCount);

  applyHeaderStyle(sheet.addRow(headers));
  sheet.columns = colWidths.map((width, i) => ({ width, key: String(i + 1) }));
  // Number cols 6 (giá trị), 7 (điều chỉnh — có thể âm), 10 (TT/hoàn — có thể âm), 11 (còn lại)
  for (const c of [6, 11]) applyNumberFormat(sheet.getColumn(c));
  applyNumberFormat(sheet.getColumn(7), "#,##0;[Red]-#,##0");
  applyNumberFormat(sheet.getColumn(10), "#,##0;[Red]-#,##0");

  const grandTotals = new Map<string, { value: Decimal; adjustment: Decimal; netPaid: Decimal; balance: Decimal }>();

  for (const o of data) {
    const value = new Decimal(o.amountOriginal);
    // Điều chỉnh giá trị đơn: tăng = dương, giảm = âm (giữ nguyên dấu gốc)
    const adjustment = new Decimal(o.adjustmentTotal);
    const balance = new Decimal(o.balanceOriginal);
    const dueDate = o.paymentDueDate ? formatDateDdMmYyyy(o.paymentDueDate) : "";
    const expenseTypeName = isPurchase ? ((o as PurchaseOrderForExport).expenseTypeName ?? "") : "";

    // Transaction rows — PAYMENT and REFUND interleaved; REFUND amount negative
    for (const tx of o.transactions) {
      const txRow: (string | number)[] = [
        o.businessUnitCode, o.partyName, o.orderNumber,
        formatDateDdMmYyyy(o.orderDate), o.currencyCode,
        "", "",  // col 6-7 blank on tx rows
        dueDate,
        formatDateDdMmYyyy(tx.transactionDate),
        tx.amountOriginal,    // signed: + payment, − refund
        "", "",
        tx.contactName ?? "", // col 13 NGƯỜI NỘP/NHẬN — only populated on tx rows
      ];
      if (isPurchase) txRow.push(""); // col 14 LOẠI CHI PHÍ blank on tx rows
      txRow.push(tx.notes ?? "");     // GHI CHÚ (col 14 SALE / col 15 PURCHASE)
      sheet.addRow(txRow);
    }

    // Total row — col 10 = net paid (gross paid − refund); LOẠI CHI PHÍ shown here
    const totalRow: (string | number)[] = [
      o.businessUnitCode, o.partyName, `${o.orderNumber}-Total`,
      formatDateDdMmYyyy(o.orderDate), o.currencyCode,
      value.toNumber(), adjustment.toNumber(),
      dueDate,
      "",  // col 9 blank on total row
      new Decimal(o.netPaidAmount).toNumber(),
      balance.toNumber(),
      getStatusLabel(o.status),
      "", // col 13 NGƯỜI NỘP/NHẬN blank on total row
    ];
    if (isPurchase) totalRow.push(expenseTypeName); // col 14
    totalRow.push(o.notes ?? "");                   // GHI CHÚ
    applySubtotalStyle(sheet.addRow(totalRow));

    addBlankRow(sheet);

    const g = grandTotals.get(o.currencyCode) ?? { value: new Decimal(0), adjustment: new Decimal(0), netPaid: new Decimal(0), balance: new Decimal(0) };
    grandTotals.set(o.currencyCode, {
      value: g.value.plus(value), adjustment: g.adjustment.plus(adjustment),
      netPaid: g.netPaid.plus(new Decimal(o.netPaidAmount)), balance: g.balance.plus(balance),
    });
  }

  // Grand total rows per currency (col 5 = Grand-{currency}, sum cols 6/7/10/11)
  for (const currency of [...grandTotals.keys()].sort()) {
    const g = grandTotals.get(currency)!;
    const grandRow: (string | number)[] = [
      "", "", "", "", `Grand-${currency}`,
      g.value.toNumber(), g.adjustment.toNumber(),
      "", "",
      g.netPaid.toNumber(), g.balance.toNumber(), "",
      "", // col 13 NGƯỜI NỘP/NHẬN blank
    ];
    if (isPurchase) grandRow.push(""); // col 14 LOẠI CHI PHÍ blank
    grandRow.push("");                 // GHI CHÚ blank
    applyGrandTotalStyle(sheet.addRow(grandRow));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** SALE detail — 13 columns. Payment rows + Total row per order. */
export async function exportSalesDetail(
  data: SaleOrderForExport[],
  dateFrom: Date,
  dateTo: Date
): Promise<Buffer> {
  return buildDetailWorkbook(data, dateFrom, dateTo, "SALE");
}

/**
 * PURCHASE detail — 14 columns. LOẠI CHI PHÍ at col 13 (before GHI CHÚ at col 14).
 * Shown on Total row only; blank on payment rows.
 */
export async function exportPurchaseDetail(
  data: PurchaseOrderForExport[],
  dateFrom: Date,
  dateTo: Date
): Promise<Buffer> {
  return buildDetailWorkbook(data, dateFrom, dateTo, "PURCHASE");
}

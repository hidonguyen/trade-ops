// Excel summary export for order reports: 11 cols (SALE) / 12 cols (PURCHASE)
// Grouped by party×currency with subtotal and grand-total rows per spec §1.2–§2.2
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

// ─── Re-export types + helpers so callers import from this module ─────────────
export type { SaleTransactionForExport, SaleOrderForExport, PurchaseOrderForExport } from "./excel-order-reports-helpers";
export { formatExpenseType } from "./excel-order-reports-helpers";

// ─── Summary column configs ───────────────────────────────────────────────────

type OrderType = "SALE" | "PURCHASE";

interface SummaryConfig {
  type: OrderType;
  title: string;
  sheetName: string;
  colCount: number;
  headers: string[];
  colWidths: number[];
}

const SALE_SUMMARY_CONFIG: SummaryConfig = {
  type: "SALE",
  title: "BÁO CÁO BÁN HÀNG TỔNG HỢP",
  sheetName: "Tổng hợp bán hàng",
  colCount: 11,
  headers: [
    "ĐƠN VỊ",           // col 1
    "ĐỐI TÁC",          // col 2
    "SỐ ĐƠN",           // col 3
    "NGÀY ĐƠN HÀNG",    // col 4
    "HẠN THANH TOÁN",   // col 5
    "TIỀN TỆ",          // col 6
    "GIÁ TRỊ ĐH",       // col 7
    "GIẢM GIÁ TRỊ ĐH",  // col 8
    "ĐÃ THANH TOÁN",    // col 9
    "CÒN PHẢI TT",      // col 10
    "TRẠNG THÁI",       // col 11
  ],
  colWidths: [10, 22, 14, 14, 14, 8, 16, 16, 16, 16, 14],
};

const PURCHASE_SUMMARY_CONFIG: SummaryConfig = {
  type: "PURCHASE",
  title: "BÁO CÁO MUA HÀNG TỔNG HỢP",
  sheetName: "Tổng hợp mua hàng",
  colCount: 12,
  headers: [
    "ĐƠN VỊ",           // col 1
    "ĐỐI TÁC",          // col 2
    "SỐ ĐƠN",           // col 3
    "NGÀY ĐƠN HÀNG",    // col 4
    "HẠN THANH TOÁN",   // col 5
    "TIỀN TỆ",          // col 6
    "GIÁ TRỊ ĐH",       // col 7
    "GIẢM GIÁ TRỊ ĐH",  // col 8
    "ĐÃ THANH TOÁN",    // col 9
    "CÒN PHẢI TT",      // col 10
    "TRẠNG THÁI",       // col 11
    "LOẠI CHI PHÍ",     // col 12
  ],
  colWidths: [10, 22, 14, 14, 14, 8, 16, 16, 16, 16, 14, 20],
};

// ─── Shared workbook builder ──────────────────────────────────────────────────

/**
 * Build summary workbook for SALE (11 cols) or PURCHASE (12 cols).
 * PURCHASE appends LOẠI CHI PHÍ on order rows; blank on subtotal/grand rows.
 */
async function buildSummaryWorkbook(
  data: SaleOrderForExport[],
  dateFrom: Date,
  dateTo: Date,
  config: SummaryConfig
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Trade Ops";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(config.sheetName);
  addTitleRow(sheet, config.title, config.colCount);
  addDateRangeRow(sheet, dateFrom, dateTo, config.colCount);

  const headerRow = sheet.addRow(config.headers);
  applyHeaderStyle(headerRow);

  sheet.columns = config.colWidths.map((width, i) => ({ width, key: String(i + 1) }));
  // Cols 7 (giá trị), 8 (giảm), 10 (còn lại) — col 9 may carry negative net paid
  applyNumberFormat(sheet.getColumn(7));
  applyNumberFormat(sheet.getColumn(8));
  applyNumberFormat(sheet.getColumn(9), "#,##0;[Red]-#,##0");
  applyNumberFormat(sheet.getColumn(10));

  // Sort: partyName asc → currencyCode asc → orderDate asc
  const sorted = [...data].sort((a, b) => {
    const p = a.partyName.localeCompare(b.partyName, "vi");
    if (p !== 0) return p;
    const c = a.currencyCode.localeCompare(b.currencyCode);
    if (c !== 0) return c;
    return a.orderDate.getTime() - b.orderDate.getTime();
  });

  const grandTotals = new Map<string, { value: Decimal; discount: Decimal; netPaid: Decimal; balance: Decimal }>();

  let groupStart = 0;
  while (groupStart < sorted.length) {
    const { partyName, currencyCode } = sorted[groupStart];
    let groupEnd = groupStart;
    while (
      groupEnd < sorted.length &&
      sorted[groupEnd].partyName === partyName &&
      sorted[groupEnd].currencyCode === currencyCode
    ) groupEnd++;

    let subValue = new Decimal(0), subDiscount = new Decimal(0);
    let subNetPaid = new Decimal(0), subBalance = new Decimal(0);

    for (let i = groupStart; i < groupEnd; i++) {
      const o = sorted[i];
      const discount = new Decimal(o.adjustmentTotal).negated();
      const value = new Decimal(o.amountOriginal);
      const netPaid = new Decimal(o.netPaidAmount);
      const balance = new Decimal(o.balanceOriginal);

      subValue = subValue.plus(value);
      subDiscount = subDiscount.plus(discount);
      subNetPaid = subNetPaid.plus(netPaid);
      subBalance = subBalance.plus(balance);

      const row: (string | number)[] = [
        o.businessUnitCode, o.partyName, o.orderNumber,
        formatDateDdMmYyyy(o.orderDate),
        o.paymentDueDate ? formatDateDdMmYyyy(o.paymentDueDate) : "",
        o.currencyCode,
        value.toNumber(), discount.toNumber(), netPaid.toNumber(), balance.toNumber(),
        getStatusLabel(o.status),
      ];
      if (config.type === "PURCHASE") {
        row.push((o as PurchaseOrderForExport).expenseTypeName ?? "");
      }
      sheet.addRow(row);
    }

    // Subtotal row — LOẠI CHI PHÍ blank
    const subRow: (string | number)[] = [
      "", `${partyName}-${currencyCode}`, "", "", "", "",
      subValue.toNumber(), subDiscount.toNumber(), subNetPaid.toNumber(), subBalance.toNumber(), "",
    ];
    if (config.type === "PURCHASE") subRow.push("");
    applySubtotalStyle(sheet.addRow(subRow));
    addBlankRow(sheet);

    const g = grandTotals.get(currencyCode) ?? { value: new Decimal(0), discount: new Decimal(0), netPaid: new Decimal(0), balance: new Decimal(0) };
    grandTotals.set(currencyCode, {
      value: g.value.plus(subValue), discount: g.discount.plus(subDiscount),
      netPaid: g.netPaid.plus(subNetPaid), balance: g.balance.plus(subBalance),
    });
    groupStart = groupEnd;
  }

  // Grand total rows — LOẠI CHI PHÍ blank
  for (const currency of [...grandTotals.keys()].sort()) {
    const g = grandTotals.get(currency)!;
    const grandRow: (string | number)[] = [
      "", "", "", "", "", `Grand-${currency}`,
      g.value.toNumber(), g.discount.toNumber(), g.netPaid.toNumber(), g.balance.toNumber(), "",
    ];
    if (config.type === "PURCHASE") grandRow.push("");
    applyGrandTotalStyle(sheet.addRow(grandRow));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Sales summary — 11 columns */
export async function exportSalesSummary(
  data: SaleOrderForExport[],
  dateFrom: Date,
  dateTo: Date
): Promise<Buffer> {
  return buildSummaryWorkbook(data, dateFrom, dateTo, SALE_SUMMARY_CONFIG);
}

/** Purchase summary — 12 columns (adds LOẠI CHI PHÍ last) */
export async function exportPurchaseSummary(
  data: PurchaseOrderForExport[],
  dateFrom: Date,
  dateTo: Date
): Promise<Buffer> {
  return buildSummaryWorkbook(data, dateFrom, dateTo, PURCHASE_SUMMARY_CONFIG);
}

// Detail exports (13 cols SALE / 14 cols PURCHASE) live in excel-sales-detail-service.ts
export { exportSalesDetail, exportPurchaseDetail } from "./excel-sales-detail-service";

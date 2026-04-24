// Cashflow summary Excel service — renders III/IV hierarchy per spec §4.1
import ExcelJS from "exceljs";
import {
  addTitleRow,
  addDateRangeRow,
  addBlankRow,
  buildReportFilename,
} from "./excel-report-utils";
import {
  BuSection,
  addSectionHeading,
  addBuHeading,
  renderSectionA,
  renderSectionB,
} from "./excel-cashflow-helpers";

export type { BuSection, OrderCashflowRow, OtherCashflowRow } from "./excel-cashflow-helpers";

const NUM_COLS = 10;

interface ExportInput {
  bus: BuSection[];
  from: Date;
  to: Date;
}

/**
 * Builds a single-sheet "Tổng hợp" Excel workbook per cashflow summary spec §4.1.
 * Returns raw Buffer ready to stream as xlsx response.
 */
export async function exportCashflowSummary(input: ExportInput): Promise<Buffer> {
  const { bus, from, to } = input;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Trade Ops";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Tổng hợp");

  // Set column widths for readability
  sheet.columns = [
    { width: 6 },   // STT
    { width: 24 },  // Đối tác / Người nộp-nhận
    { width: 16 },  // Mã ĐH / Nội dung
    { width: 14 },  // Ngày
    { width: 10 },  // Tiền tệ / PTTT
    { width: 18 },  // Nợ cũ / Mã tham chiếu
    { width: 18 },  // TT lần này / Tiền tệ
    { width: 18 },  // Nợ còn lại / Nguyên tệ
    { width: 18 },  // Quy đổi VNĐ
    { width: 20 },  // Ghi chú
  ];

  // Row 1: title
  addTitleRow(sheet, "BÁO CÁO TỔNG HỢP THU CHI", NUM_COLS);

  // Row 2: date range
  addDateRangeRow(sheet, from, to, NUM_COLS);

  addBlankRow(sheet);

  // ─── Section III ────────────────────────────────────────────────────────────

  const buWithReceipts = bus.filter(
    (b) => b.customerReceipts.length > 0 || b.otherReceipts.length > 0
  );

  if (buWithReceipts.length > 0) {
    addSectionHeading(sheet, "III. Các khoản phải thu");

    for (const bu of buWithReceipts) {
      addBuHeading(sheet, bu.buCode);

      renderSectionA(sheet, "a. Thu từ khách hàng", bu.customerReceipts);
      renderSectionB(sheet, "b. Thu khác", bu.otherReceipts);

      addBlankRow(sheet);
    }
  }

  // ─── Section IV ────────────────────────────────────────────────────────────

  const buWithPayments = bus.filter(
    (b) => b.supplierPayments.length > 0 || b.otherPayments.length > 0
  );

  if (buWithPayments.length > 0) {
    addSectionHeading(sheet, "IV. Các khoản phải trả");

    for (const bu of buWithPayments) {
      addBuHeading(sheet, bu.buCode);

      renderSectionA(sheet, "a. Phải trả nhà cung cấp", bu.supplierPayments);
      renderSectionB(sheet, "b. Chi khác", bu.otherPayments);

      addBlankRow(sheet);
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Returns the standardised xlsx filename for this report */
export function buildCashflowFilename(from: Date, to: Date): string {
  return buildReportFilename("tong-hop", from, to);
}

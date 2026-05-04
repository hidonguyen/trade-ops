// Deposit tracking export — single flat sheet, master rows (bold) interleaved
// with indented detail rows for each usage event.
import ExcelJS from "exceljs";
import { applyHeaderStyle, formatDateDdMmYyyy, buildReportFilename } from "./excel-report-utils";

export interface DepositMasterExport {
  createdAt: Date | string;
  source: string;
  partyName: string;
  partyType: string;
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

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

export async function exportDepositTracking(deposits: DepositMasterExport[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Trade Ops";
  wb.created = new Date();
  const sheet = wb.addWorksheet("Theo dõi cọc");
  sheet.columns = [
    { header: "Ngày", key: "date", width: 16 },
    { header: "Loại", key: "kind", width: 16 },
    { header: "Đối tác", key: "party", width: 24 },
    { header: "Đơn vị", key: "bu", width: 8 },
    { header: "Tiền tệ", key: "ccy", width: 10 },
    { header: "Số tiền", key: "amount", width: 18 },
    { header: "Số dư", key: "remaining", width: 18 },
    { header: "Tham chiếu / Ghi chú", key: "ref", width: 32 },
  ];
  applyHeaderStyle(sheet.getRow(1));

  for (const d of deposits) {
    const masterRow = sheet.addRow({
      date: formatDateDdMmYyyy(toDate(d.createdAt)),
      kind: d.source === "REFUND"
        ? (d.partyType === "SUPPLIER" ? "Hoàn từ đơn mua" : "Hoàn từ đơn bán")
        : (d.partyType === "SUPPLIER" ? "Cọc NCC" : "Cọc KH"),
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
      const uRow = sheet.addRow({
        date: `  ↳ ${formatDateDdMmYyyy(toDate(u.createdAt))}`,
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

export function buildDepositTrackingFilename(from: Date | null, to: Date | null): string {
  return buildReportFilename("theo-doi-coc", from ?? new Date(), to ?? new Date());
}

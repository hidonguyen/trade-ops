// Generate DOCX summary report — structured by BU with debt tracking tables
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, WidthType, BorderStyle, AlignmentType,
} from "docx";

interface OrderDebtRow {
  partyName: string;
  orderNumber: string;
  orderDate: string;
  currencyCode: string;
  currencySymbol: string;
  priorDebt: string;
  periodPayment: string;
  remainingDebt: string;
  notes: string | null;
}

interface StandaloneRow {
  transactionDate: string;
  amountOriginal: string;
  currencyCode: string;
  currencySymbol: string;
  paymentMethod: string;
  bankReference: string | null;
  notes: string | null;
}

interface BuSummaryData {
  buCode: string;
  buName: string;
  customerReceipts: OrderDebtRow[];
  otherReceipts: StandaloneRow[];
  supplierPayments: OrderDebtRow[];
  otherPayments: StandaloneRow[];
}

// Shared table cell border style
const BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
} as const;

function headerCell(text: string, width?: number): TableCell {
  return new TableCell({
    borders: BORDERS,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, font: "Times New Roman" })] })],
  });
}

function cell(text: string): TableCell {
  return new TableCell({
    borders: BORDERS,
    children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: "Times New Roman" })] })],
  });
}

function numCell(text: string): TableCell {
  return new TableCell({
    borders: BORDERS,
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text, size: 20, font: "Times New Roman" })],
    })],
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN");
}

function fmtNum(val: string, symbol?: string): string {
  const n = parseFloat(val);
  const formatted = isNaN(n) ? val : n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
  return symbol ? `${symbol}${formatted}` : formatted;
}

function buildOrderTable(rows: OrderDebtRow[]): Table {
  const header = new TableRow({
    children: [
      headerCell("STT", 600),
      headerCell("Đối tác", 2400),
      headerCell("Mã ĐH", 1200),
      headerCell("Ngày tháng", 1200),
      headerCell("Nợ cũ", 1400),
      headerCell("TT lần này", 1400),
      headerCell("Nợ còn lại", 1400),
      headerCell("Ghi chú", 1600),
    ],
  });

  const dataRows = rows.map((r, i) =>
    new TableRow({
      children: [
        cell(String(i + 1)),
        cell(r.partyName),
        cell(r.orderNumber),
        cell(fmtDate(r.orderDate)),
        numCell(fmtNum(r.priorDebt, r.currencySymbol)),
        numCell(fmtNum(r.periodPayment, r.currencySymbol)),
        numCell(fmtNum(r.remainingDebt, r.currencySymbol)),
        cell(r.notes ?? ""),
      ],
    })
  );

  return new Table({ rows: [header, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

function buildStandaloneTable(rows: StandaloneRow[]): Table {
  const header = new TableRow({
    children: [
      headerCell("STT", 600),
      headerCell("Ngày", 1400),
      headerCell("Số tiền", 1600),
      headerCell("Tiền tệ", 900),
      headerCell("Phương thức", 1400),
      headerCell("Tham chiếu", 1600),
      headerCell("Ghi chú", 2000),
    ],
  });

  const dataRows = rows.map((r, i) =>
    new TableRow({
      children: [
        cell(String(i + 1)),
        cell(fmtDate(r.transactionDate)),
        numCell(fmtNum(r.amountOriginal, r.currencySymbol)),
        cell(r.currencyCode),
        cell(r.paymentMethod === "BANK" ? "Ngân hàng" : "Cọc"),
        cell(r.bankReference ?? ""),
        cell(r.notes ?? ""),
      ],
    })
  );

  return new Table({ rows: [header, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

function emptyNote(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, italics: true, size: 20, font: "Times New Roman", color: "888888" })],
    spacing: { before: 100, after: 200 },
  });
}

function sectionHeading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({
    heading: level,
    children: [new TextRun({ text, bold: true, size: 24, font: "Times New Roman" })],
    spacing: { before: 300, after: 100 },
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, font: "Times New Roman" })],
    spacing: { before: 200, after: 100 },
  });
}

export async function generateSummaryDocx(
  allBuData: BuSummaryData[],
  dateFrom: string,
  dateTo: string,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "BÁO CÁO TỔNG HỢP THU CHI", bold: true, size: 32, font: "Times New Roman" })],
    spacing: { after: 100 },
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `Kỳ: ${fmtDate(dateFrom)} - ${fmtDate(dateTo)}`, size: 22, font: "Times New Roman" })],
    spacing: { after: 400 },
  }));

  // I. CÁC KHOẢN THU
  children.push(sectionHeading("I. CÁC KHOẢN THU", HeadingLevel.HEADING_1));

  allBuData.forEach((bu, idx) => {
    children.push(sectionHeading(`${idx + 1}. ${bu.buCode} — ${bu.buName}`, HeadingLevel.HEADING_2));

    children.push(subHeading("a. Thu từ khách hàng"));
    if (bu.customerReceipts.length > 0) {
      children.push(buildOrderTable(bu.customerReceipts));
    } else {
      children.push(emptyNote("Không có dữ liệu"));
    }

    children.push(subHeading("b. Thu khác"));
    if (bu.otherReceipts.length > 0) {
      children.push(buildStandaloneTable(bu.otherReceipts));
    } else {
      children.push(emptyNote("Không có dữ liệu"));
    }
  });

  // II. CÁC KHOẢN CHI
  children.push(sectionHeading("II. CÁC KHOẢN CHI", HeadingLevel.HEADING_1));

  allBuData.forEach((bu, idx) => {
    children.push(sectionHeading(`${idx + 1}. ${bu.buCode} — ${bu.buName}`, HeadingLevel.HEADING_2));

    children.push(subHeading("a. Chi trả nhà cung cấp"));
    if (bu.supplierPayments.length > 0) {
      children.push(buildOrderTable(bu.supplierPayments));
    } else {
      children.push(emptyNote("Không có dữ liệu"));
    }

    children.push(subHeading("b. Chi khác"));
    if (bu.otherPayments.length > 0) {
      children.push(buildStandaloneTable(bu.otherPayments));
    } else {
      children.push(emptyNote("Không có dữ liệu"));
    }
  });

  const doc = new Document({
    sections: [{ children }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

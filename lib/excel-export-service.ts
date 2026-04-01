// Excel export helpers using ExcelJS — cashflow, orders, and transactions
import ExcelJS from "exceljs";

interface CashflowTransaction {
  transactionDate: Date | string;
  type: string;
  partyName?: string | null;
  amountOriginal: string | number;
  currencyCode: string;
  paymentMethod: string;
  bankReference?: string | null;
  paymentType: string;
  notes?: string | null;
}

interface CashflowExportData {
  currencies: Array<{
    code: string;
    symbol: string;
    totalIn: string;
    totalOut: string;
    net: string;
  }>;
  transactions: CashflowTransaction[];
}

// Style header row bold with background
function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };
  row.alignment = { horizontal: "center" };
}

export async function exportCashflowToExcel(data: CashflowExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Trade Ops";
  workbook.created = new Date();

  // Sheet 1: Summary by currency
  const summarySheet = workbook.addWorksheet("Currency Summary");
  summarySheet.columns = [
    { header: "Currency", key: "code", width: 12 },
    { header: "Symbol", key: "symbol", width: 10 },
    { header: "Total In", key: "totalIn", width: 20 },
    { header: "Total Out", key: "totalOut", width: 20 },
    { header: "Net", key: "net", width: 20 },
  ];
  styleHeaderRow(summarySheet.getRow(1));
  for (const row of data.currencies) {
    summarySheet.addRow(row);
  }

  // Sheet 2: Transaction detail
  const txSheet = workbook.addWorksheet("Cashflow Transactions");
  txSheet.columns = [
    { header: "Date", key: "date", width: 15 },
    { header: "Type", key: "type", width: 18 },
    { header: "Party", key: "party", width: 25 },
    { header: "Amount", key: "amount", width: 20 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Method", key: "method", width: 12 },
    { header: "Payment Type", key: "paymentType", width: 14 },
    { header: "Reference", key: "reference", width: 22 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  styleHeaderRow(txSheet.getRow(1));

  for (const tx of data.transactions) {
    const dateVal =
      tx.transactionDate instanceof Date
        ? tx.transactionDate.toISOString().slice(0, 10)
        : String(tx.transactionDate).slice(0, 10);
    txSheet.addRow({
      date: dateVal,
      type: tx.type,
      party: tx.partyName ?? "",
      amount: tx.amountOriginal,
      currency: tx.currencyCode,
      method: tx.paymentMethod,
      paymentType: tx.paymentType,
      reference: tx.bankReference ?? "",
      notes: tx.notes ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

interface OrderRow {
  orderDate: Date | string;
  type: string;
  partyName: string;
  amountOriginal: string | number;
  currencyCode: string;
  status: string;
  paidAmount: string | number;
  refundedAmount: string | number;
  notes?: string | null;
}

export async function exportOrdersToExcel(orders: OrderRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Trade Ops";

  const sheet = workbook.addWorksheet("Orders");
  sheet.columns = [
    { header: "Order Date", key: "orderDate", width: 15 },
    { header: "Type", key: "type", width: 12 },
    { header: "Party", key: "party", width: 25 },
    { header: "Amount", key: "amount", width: 20 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Status", key: "status", width: 18 },
    { header: "Paid", key: "paidAmount", width: 20 },
    { header: "Refunded", key: "refundedAmount", width: 20 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  styleHeaderRow(sheet.getRow(1));

  for (const order of orders) {
    const dateVal =
      order.orderDate instanceof Date
        ? order.orderDate.toISOString().slice(0, 10)
        : String(order.orderDate).slice(0, 10);
    sheet.addRow({
      orderDate: dateVal,
      type: order.type,
      party: order.partyName,
      amount: order.amountOriginal,
      currency: order.currencyCode,
      status: order.status,
      paidAmount: order.paidAmount,
      refundedAmount: order.refundedAmount,
      notes: order.notes ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

interface TransactionRow {
  transactionDate: Date | string;
  type: string;
  partyName?: string | null;
  amountOriginal: string | number;
  currencyCode: string;
  paymentMethod: string;
  paymentType: string;
  bankReference?: string | null;
  notes?: string | null;
}

export async function exportTransactionsToExcel(transactions: TransactionRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Trade Ops";

  const sheet = workbook.addWorksheet("Transactions");
  sheet.columns = [
    { header: "Date", key: "date", width: 15 },
    { header: "Type", key: "type", width: 20 },
    { header: "Party", key: "party", width: 25 },
    { header: "Amount", key: "amount", width: 20 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Method", key: "method", width: 12 },
    { header: "Payment Type", key: "paymentType", width: 14 },
    { header: "Reference", key: "reference", width: 22 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  styleHeaderRow(sheet.getRow(1));

  for (const tx of transactions) {
    const dateVal =
      tx.transactionDate instanceof Date
        ? tx.transactionDate.toISOString().slice(0, 10)
        : String(tx.transactionDate).slice(0, 10);
    sheet.addRow({
      date: dateVal,
      type: tx.type,
      party: tx.partyName ?? "",
      amount: tx.amountOriginal,
      currency: tx.currencyCode,
      method: tx.paymentMethod,
      paymentType: tx.paymentType,
      reference: tx.bankReference ?? "",
      notes: tx.notes ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

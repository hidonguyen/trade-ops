// Excel export helpers using ExcelJS — cashflow, orders, and transactions
import ExcelJS from "exceljs";
import { applyHeaderStyle } from "./excel-report-utils";
import { getPaymentMethodLabel } from "./payment-method-labels";

interface CashflowTransaction {
  transactionDate: Date | string;
  // Single combined Vietnamese category: "Thu bán hàng", "Chi mua hàng",
  // "Thu/Chi hoàn tiền", "Thu/Chi đặt cọc khách hàng", etc.
  category?: string;
  isMoneyIn?: boolean;
  type?: string;
  partyName?: string | null;
  expenseTypeName?: string | null;
  description?: string | null;
  orderNumber?: string | null;
  amountOriginal: string | number;
  amountVnd?: string | number;
  currencyCode: string;
  paymentMethod: string;
  bankReference?: string | null;
  paymentType?: string;
  notes?: string | null;
  bankFeeOriginal?: string | null;
  bankFeeVnd?: string | null;
  businessUnit?: { code: string; name?: string | null };
  createdBy?: string;
}

interface CashflowExportData {
  currencies: Array<{
    code: string;
    symbol: string;
    totalIn: string;
    totalOut: string;
    net: string;
    totalBankFee?: string;
    netAfterFee?: string;
  }>;
  transactions: CashflowTransaction[];
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
    { header: "Bank Fee", key: "totalBankFee", width: 18 },
    { header: "Net After Fee", key: "netAfterFee", width: 20 },
  ];
  applyHeaderStyle(summarySheet.getRow(1));
  for (const row of data.currencies) {
    summarySheet.addRow({
      ...row,
      totalBankFee: row.totalBankFee ?? "0",
      netAfterFee: row.netAfterFee ?? row.net,
    });
  }

  // Sheet 2: Transaction detail
  const txSheet = workbook.addWorksheet("Cashflow Transactions");
  txSheet.columns = [
    { header: "Date", key: "date", width: 15 },
    { header: "BU", key: "bu", width: 8 },
    { header: "Loại", key: "category", width: 24 },
    { header: "Đối tác", key: "party", width: 25 },
    { header: "Diễn giải", key: "description", width: 30 },
    { header: "Mã đơn", key: "orderNumber", width: 14 },
    { header: "Nguyên tệ", key: "amount", width: 20 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Phí NH", key: "bankFeeOriginal", width: 18 },
    { header: "Quy đổi VND", key: "amountVnd", width: 20 },
    { header: "Phí NH (VND)", key: "bankFeeVnd", width: 18 },
    { header: "Tham chiếu", key: "reference", width: 22 },
    { header: "Ghi chú", key: "notes", width: 30 },
    { header: "Người tạo", key: "createdBy", width: 18 },
  ];
  applyHeaderStyle(txSheet.getRow(1));

  for (const tx of data.transactions) {
    const dateVal =
      tx.transactionDate instanceof Date
        ? tx.transactionDate.toISOString().slice(0, 10)
        : String(tx.transactionDate).slice(0, 10);
    // Sign by direction: money-out rows render negative for cleaner cashflow sums.
    const sign = tx.isMoneyIn === false ? -1 : 1;
    txSheet.addRow({
      date: dateVal,
      bu: tx.businessUnit?.code ?? "",
      category: tx.category ?? tx.type ?? "",
      party: tx.partyName ?? "",
      description: tx.description ?? "",
      orderNumber: tx.orderNumber ?? "",
      amount: sign * Number(tx.amountOriginal),
      currency: tx.currencyCode,
      bankFeeOriginal: tx.bankFeeOriginal ?? "",
      amountVnd: tx.amountVnd != null ? sign * Number(tx.amountVnd) : "",
      bankFeeVnd: tx.bankFeeVnd ?? "",
      reference: tx.bankReference ?? "",
      notes: tx.notes ?? "",
      createdBy: tx.createdBy ?? "",
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
  applyHeaderStyle(sheet.getRow(1));

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
  applyHeaderStyle(sheet.getRow(1));

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
      method: getPaymentMethodLabel(tx.paymentMethod),
      paymentType: tx.paymentType,
      reference: tx.bankReference ?? "",
      notes: tx.notes ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Bank fee report export — transactions with company-borne bank fees
interface BankFeeRow {
  transactionDate: Date | string;
  businessUnitCode: string;
  partyName?: string | null;
  orderNumber?: string | null;
  type: string;
  amountOriginal: string | number;
  currencyCode: string;
  bankFeeOriginal: string | number;
  bankFeeVnd: string | number;
  exchangeRate: string | number;
  bankReference?: string | null;
  notes?: string | null;
}

interface BankFeeExportData {
  rows: BankFeeRow[];
  totals: {
    grandFeeVnd: string;
    byCurrency: Array<{ code: string; totalFeeOriginal: string; totalFeeVnd: string }>;
  };
}

export async function exportBankFeesToExcel(data: BankFeeExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Trade Ops";
  workbook.created = new Date();

  const totalsSheet = workbook.addWorksheet("Summary");
  totalsSheet.columns = [
    { header: "Currency", key: "code", width: 12 },
    { header: "Total Fee (Orig)", key: "totalFeeOriginal", width: 22 },
    { header: "Total Fee (VND)", key: "totalFeeVnd", width: 22 },
  ];
  applyHeaderStyle(totalsSheet.getRow(1));
  for (const row of data.totals.byCurrency) {
    totalsSheet.addRow(row);
  }
  const grandRow = totalsSheet.addRow({
    code: "GRAND TOTAL (VND)",
    totalFeeOriginal: "",
    totalFeeVnd: data.totals.grandFeeVnd,
  });
  grandRow.font = { bold: true };

  const detailSheet = workbook.addWorksheet("Bank Fees");
  detailSheet.columns = [
    { header: "Date", key: "date", width: 15 },
    { header: "Business Unit", key: "bu", width: 14 },
    { header: "Party", key: "party", width: 25 },
    { header: "Order No.", key: "orderNumber", width: 16 },
    { header: "Type", key: "type", width: 18 },
    { header: "Amount", key: "amount", width: 20 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Fee (Orig)", key: "feeOrig", width: 18 },
    { header: "Fee (VND)", key: "feeVnd", width: 18 },
    { header: "Exchange Rate", key: "rate", width: 16 },
    { header: "Reference", key: "reference", width: 22 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  applyHeaderStyle(detailSheet.getRow(1));

  for (const row of data.rows) {
    const dateVal =
      row.transactionDate instanceof Date
        ? row.transactionDate.toISOString().slice(0, 10)
        : String(row.transactionDate).slice(0, 10);
    detailSheet.addRow({
      date: dateVal,
      bu: row.businessUnitCode,
      party: row.partyName ?? "",
      orderNumber: row.orderNumber ?? "",
      type: row.type,
      amount: row.amountOriginal,
      currency: row.currencyCode,
      feeOrig: row.bankFeeOriginal,
      feeVnd: row.bankFeeVnd,
      rate: row.exchangeRate,
      reference: row.bankReference ?? "",
      notes: row.notes ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

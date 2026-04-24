// Shared types, constants, and helpers for order Excel report services
// Used by excel-order-reports-service.ts (summary) and excel-sales-detail-service.ts (detail)

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SalePaymentForExport {
  transactionDate: Date;
  amountOriginal: number;
  notes?: string | null;
}

export interface SaleOrderForExport {
  businessUnitCode: string;
  partyName: string;
  orderNumber: string;
  orderDate: Date;
  paymentDueDate?: Date | null;
  currencyCode: string;
  amountOriginal: number;
  adjustmentTotal: number;
  paidAmount: number;
  balanceOriginal: number;
  effectiveValue: number;
  status: string;
  notes?: string | null;
  payments: SalePaymentForExport[];
}

/** Extended interface for PURCHASE orders — adds expense type */
export interface PurchaseOrderForExport extends SaleOrderForExport {
  expenseTypeName: string; // "" when no expenseType; includes "(ngừng)" suffix if deactivated
}

// ─── Status label map ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  UNPAID: "Chưa TT",
  PARTIAL_PAID: "TT 1 phần",
  PAID: "Đã TT",
  PARTIAL_REFUNDED: "Hoàn 1 phần",
  REFUNDED: "Đã hoàn",
};

/** Map internal status code to Vietnamese display label */
export function getStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/** Format expense type name — append "(ngừng)" suffix when type is deactivated */
export function formatExpenseType(name: string, isActive: boolean): string {
  return isActive ? name : `${name} (ngừng)`;
}

// ─── Grand-total accumulator type ────────────────────────────────────────────

export interface GrandTotalAccum {
  value: import("decimal.js").Decimal;
  discount: import("decimal.js").Decimal;
  paid: import("decimal.js").Decimal;
  balance: import("decimal.js").Decimal;
}

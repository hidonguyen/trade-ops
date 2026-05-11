// Transaction list sub-component for order detail page
// Shows all linked transactions with edit and delete actions
"use client";

import { useState } from "react";
import { DataTable, Column } from "@/components/shared/data-table";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { CurrencyAmount } from "@/components/shared/currency-amount";
import { Button } from "@/components/ui/button";
import { Trash2Icon, PencilIcon } from "lucide-react";
import { useCan } from "@/components/providers/roles-provider";
import { getPaymentMethodLabel } from "@/lib/payment-method-labels";

interface Transaction {
  id: string;
  paymentType: string;
  paymentMethod: string;
  amountOriginal: string;
  amountVnd: string;
  exchangeRate: string;
  bankReference: string | null;
  transactionDate: string;
  notes: string | null;
  bankFeeOriginal: string | null;
  bankFeeVnd: string | null;
  currency: { id: string; code: string; symbol: string };
}

interface OrderTransactionsTableProps {
  orderId: string;
  orderType?: "SALE" | "PURCHASE" | string;
  transactions: Transaction[];
  onDeleted: () => void;
  onEdit?: (transaction: Transaction) => void;
  canDelete?: boolean;
  canEdit?: boolean;
}

// Map a tx (paymentType) on an order to the RBAC module that gates write actions on it.
// Order-linked tx writes are gated by parent order module (SALE/PURCHASE),
// matching the API. Cash-direction (RECEIPT/PAYMENT) only gates the standalone
// /transactions screen — not txs that belong to an order.
function moduleForTx(orderType: string | undefined): "SALE" | "PURCHASE" {
  return orderType === "PURCHASE" ? "PURCHASE" : "SALE";
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  PAYMENT: "Thanh toán",
  REFUND: "Hoàn tiền",
  ADJUSTMENT: "Điều chỉnh giá trị đơn hàng",
};

export function OrderTransactionsTable({
  orderId,
  orderType,
  transactions,
  onDeleted,
  onEdit,
  canDelete = true,
  canEdit = true,
}: OrderTransactionsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Compute role-based capabilities for both money directions and both order types.
  // Per-row gating combines these with `moduleForTx(orderType, paymentType)`.
  const caps = {
    UPDATE: {
      SALE: useCan("UPDATE", "SALE"),
      PURCHASE: useCan("UPDATE", "PURCHASE"),
    },
    DELETE: {
      SALE: useCan("DELETE", "SALE"),
      PURCHASE: useCan("DELETE", "PURCHASE"),
    },
  } as const;

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/transactions/${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Lỗi xóa giao dịch");
      onDeleted();
    } catch (err) {
      console.error("Lỗi xóa giao dịch:", err);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  const hasActions = canEdit || canDelete;

  const columns: Column<Transaction>[] = [
    {
      key: "transactionDate",
      label: "Ngày",
      sortable: true,
      render: (v) => new Date(v).toLocaleDateString("vi-VN"),
    },
    {
      key: "paymentType",
      label: "Loại",
      render: (v) => {
        const isAdj = v === "ADJUSTMENT";
        const colorClass = isAdj
          ? "bg-slate-100 text-slate-700"
          : v === "PAYMENT"
          ? "bg-green-100 text-green-700"
          : "bg-orange-100 text-orange-700";
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
            {PAYMENT_TYPE_LABEL[v] ?? v}
          </span>
        );
      },
    },
    {
      key: "paymentMethod",
      label: "Phương thức",
      // ADJUSTMENT rows skip method column — not meaningful
      render: (v, row) => row.paymentType === "ADJUSTMENT" ? <span className="text-slate-400">—</span> : getPaymentMethodLabel(v as string),
    },
    {
      key: "amountOriginal",
      label: "Số tiền",
      align: "right",
      render: (v, row) => {
        // ADJUSTMENT: CurrencyAmount already shows negative with red color; positive gets green tint
        const isAdj = row.paymentType === "ADJUSTMENT";
        const cls = isAdj && parseFloat(v as string) > 0 ? "text-green-700" : undefined;
        return (
          <CurrencyAmount
            amount={v}
            currencyCode={row.currency?.code ?? "VND"}
            currencySymbol={row.currency?.symbol ?? "₫"}
            className={cls}
          />
        );
      },
    },
    {
      key: "amountVnd",
      label: "VND",
      align: "right",
      render: (v) => (
        <CurrencyAmount amount={v} currencyCode="VND" currencySymbol="₫" />
      ),
    },
    {
      key: "bankFeeOriginal",
      label: "Phí NH",
      align: "right",
      render: (v, row) =>
        row.paymentType !== "ADJUSTMENT" && v && parseFloat(v as string) > 0 ? (
          <CurrencyAmount
            amount={v as string}
            currencyCode={row.currency?.code ?? "VND"}
            currencySymbol={row.currency?.symbol ?? "₫"}
          />
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "bankReference",
      label: "Tham chiếu",
      render: (v) => v ?? "—",
    },
    ...(hasActions
      ? [{
          key: "actions",
          label: "",
          render: (_: unknown, row: Transaction) => {
            const mod = moduleForTx(orderType);
            const rowCanEdit = canEdit && caps.UPDATE[mod];
            const rowCanDelete = canDelete && caps.DELETE[mod];
            return (
            <div className="flex items-center gap-1">
              {rowCanEdit && onEdit && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                  onClick={(e) => { e.stopPropagation(); onEdit(row); }}
                >
                  <PencilIcon className="size-4" />
                </Button>
              )}
              {rowCanDelete && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              )}
            </div>
            );
          },
        } as Column<Transaction>]
      : []),
  ];

  return (
    <>
      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={transactions as unknown as Record<string, unknown>[]}
        emptyMessage="Chưa có giao dịch nào"
      />

      <ConfirmationDialog
        open={!!deleteId}
        title="Xóa giao dịch"
        description="Giao dịch này sẽ bị xóa vĩnh viễn và trạng thái đơn hàng sẽ được cập nhật lại. Bạn có chắc chắn?"
        variant="danger"
        confirmLabel={deleting ? "Đang xóa..." : "Xóa"}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}

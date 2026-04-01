// Transaction list sub-component for order detail page
// Shows all linked transactions with delete action
"use client";

import { useState } from "react";
import { DataTable, Column } from "@/components/shared/data-table";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { CurrencyAmount } from "@/components/shared/currency-amount";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";

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
  currency: { id: string; code: string; symbol: string };
}

interface OrderTransactionsTableProps {
  orderId: string;
  transactions: Transaction[];
  onDeleted: () => void;
  canDelete?: boolean;
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  PAYMENT: "Thanh toán",
  REFUND: "Hoàn tiền",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  BANK: "Ngân hàng",
  DEPOSIT: "Cọc",
};

export function OrderTransactionsTable({
  orderId,
  transactions,
  onDeleted,
  canDelete = true,
}: OrderTransactionsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      console.error("Delete transaction error:", err);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

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
      render: (v) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          v === "PAYMENT" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
        }`}>
          {PAYMENT_TYPE_LABEL[v] ?? v}
        </span>
      ),
    },
    {
      key: "paymentMethod",
      label: "Phương thức",
      render: (v) => PAYMENT_METHOD_LABEL[v] ?? v,
    },
    {
      key: "amountOriginal",
      label: "Số tiền",
      align: "right",
      render: (v, row) => (
        <CurrencyAmount
          amount={v}
          currencyCode={row.currency?.code ?? "VND"}
          currencySymbol={row.currency?.symbol ?? "₫"}
        />
      ),
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
      key: "bankReference",
      label: "Tham chiếu",
      render: (v) => v ?? "—",
    },
    ...(canDelete
      ? [{
          key: "actions",
          label: "",
          render: (_: unknown, row: Transaction) => (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }}
            >
              <Trash2Icon className="size-4" />
            </Button>
          ),
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

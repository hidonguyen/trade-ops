// Deposit list with remaining balances — fetches /api/parties/[id]/deposits
// Row actions: edit (pencil) + delete (trash, disabled when usages exist)
"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/data-table";
import { CurrencyAmount } from "@/components/shared/currency-amount";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { DepositForm } from "@/components/deposit-form";
import { DepositEditDialog, EnrichedDeposit } from "@/components/deposit-edit-dialog";

interface Deposit extends EnrichedDeposit {
  createdAt: string;
}

interface DepositListProps {
  partyId: string;
}

export function DepositList({ partyId }: DepositListProps) {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState<Deposit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deposit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/parties/${partyId}/deposits`);
      const json = await res.json();
      if (json.success) setDeposits(json.data);
    } catch {
      // silently fail — table shows empty state
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/parties/${partyId}/deposits/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Lỗi xóa cọc");
      setDeleteTarget(null);
      fetchDeposits();
    } catch (err) {
      console.error("Lỗi xóa cọc:", err);
    } finally {
      setDeleting(false);
    }
  }

  // Action cell extracted to avoid bloating column definitions
  function ActionCell({ row }: { row: Deposit }) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
          onClick={(e) => { e.stopPropagation(); setEditingDeposit(row); }}
        >
          <PencilIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none"
          disabled={row.usageCount > 0}
          title={row.usageCount > 0 ? "Không thể xóa — cọc đã có giao dịch" : "Xóa cọc"}
          onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
    );
  }

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "createdAt", label: "Ngày", sortable: true,
      render: (v) => new Date(String(v)).toLocaleDateString("vi-VN"),
    },
    {
      key: "businessUnit", label: "Đơn vị",
      render: (v) => {
        const bu = v as Deposit["businessUnit"];
        return <span className="text-sm">{bu?.code}</span>;
      },
    },
    {
      key: "amountOriginal", label: "Số tiền gốc", align: "right",
      render: (v, row) => {
        const dep = row as unknown as Deposit;
        return <CurrencyAmount amount={String(v)} currencySymbol={dep.currency.symbol} currencyCode={dep.currency.code} />;
      },
    },
    {
      key: "remainingOriginal", label: "Còn lại", align: "right",
      render: (v, row) => {
        const dep = row as unknown as Deposit;
        const remaining = parseFloat(String(v));
        return (
          <CurrencyAmount
            amount={String(v)}
            currencySymbol={dep.currency.symbol}
            currencyCode={dep.currency.code}
            className={remaining <= 0 ? "text-slate-400 line-through" : "text-green-700"}
          />
        );
      },
    },
    {
      key: "notes", label: "Ghi chú",
      render: (v) => {
        const text = (v as string | null) ?? "";
        if (!text) return <span className="text-slate-300">—</span>;
        return (
          <span className="text-sm text-slate-600 line-clamp-2 whitespace-pre-wrap break-words" title={text}>
            {text}
          </span>
        );
      },
    },
    {
      key: "actions", label: "",
      render: (_v, row) => <ActionCell row={row as unknown as Deposit} />,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Tiền đặt cọc</h3>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <PlusIcon className="size-4 mr-1" />Thêm cọc
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={deposits as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Chưa có tiền đặt cọc"
      />

      <DepositForm
        partyId={partyId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => { setDialogOpen(false); fetchDeposits(); }}
      />

      <DepositEditDialog
        open={!!editingDeposit}
        deposit={editingDeposit}
        partyId={partyId}
        onClose={() => setEditingDeposit(null)}
        onSuccess={() => { setEditingDeposit(null); fetchDeposits(); }}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Xóa tiền đặt cọc"
        description="Cọc này sẽ bị xóa vĩnh viễn. Bạn có chắc chắn?"
        variant="danger"
        confirmLabel={deleting ? "Đang xóa..." : "Xóa"}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

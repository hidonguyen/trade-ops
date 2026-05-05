// Standalone transaction list — RECEIPT/PAYMENT not linked to orders
// Supports edit (dialog) and delete (confirmation) actions
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { CurrencyAmount } from "@/components/shared/currency-amount";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { TransactionEditDialog, EditableTransaction } from "@/components/transaction-edit-dialog";
import { DateQuickPresets } from "@/components/shared/date-quick-presets";
import { getInitialDateRange, usePersistDateRange, useRestorePersistedDateRange } from "@/components/shared/use-persisted-date-range";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useCan } from "@/components/providers/roles-provider";

interface Transaction {
  id: string;
  type: string;
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
  businessUnit: { id: string; code: string; name: string };
  expenseType?: { id: string; name: string; isActive: boolean } | null;
}

interface ExpenseTypeOption {
  id: string;
  name: string;
  isActive: boolean;
}

const TYPE_OPTIONS = [
  { value: "RECEIPT", label: "Thu tiền" },
  { value: "PAYMENT", label: "Chi tiền" },
];

const METHOD_OPTIONS = [
  { value: "BANK", label: "Ngân hàng" },
  { value: "DEPOSIT", label: "Cọc" },
];

export default function TransactionsPage() {
  const router = useRouter();
  const { selectedBuId, isLoaded: buLoaded } = useSelectedBu();
  const canEditReceipt = useCan("UPDATE", "RECEIPT");
  const canEditPayment = useCan("UPDATE", "PAYMENT");
  const canDeleteReceipt = useCan("DELETE", "RECEIPT");
  const canDeletePayment = useCan("DELETE", "PAYMENT");
  const canCreateReceipt = useCan("CREATE", "RECEIPT");
  const canCreatePayment = useCan("CREATE", "PAYMENT");
  const canCreateAny = canCreateReceipt || canCreatePayment;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>(() => ({
    ...getInitialDateRange("transactions"),
  }));
  const dateRestored = useRestorePersistedDateRange("transactions", (range) => {
    setFilters((prev) => ({ ...prev, ...range }));
  });
  usePersistDateRange("transactions", filters.dateFrom, filters.dateTo);
  const [editingTx, setEditingTx] = useState<EditableTransaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeOption[]>([]);

  // Load expense types for filter
  useEffect(() => {
    fetch("/api/expense-types")
      .then((r) => r.json())
      .then((json) => { if (json.success) setExpenseTypes(json.data.filter((e: ExpenseTypeOption) => e.isActive)); })
      .catch(console.error);
  }, []);

  const fetchTransactions = useCallback(async (signal?: AbortSignal) => {
    if (!buLoaded || !selectedBuId || !dateRestored) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        businessUnitId: selectedBuId,
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        ...(filters.bankReference ? { bankReference: filters.bankReference } : {}),
        ...(filters.expenseTypeId ? { expenseTypeId: filters.expenseTypeId } : {}),
      });
      const res = await fetch(`/api/transactions?${params}`, { signal });
      if (signal?.aborted) return;
      const json = await res.json();
      if (json.success) {
        setTransactions(json.data);
        setTotal(json.pagination?.total ?? 0);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Lỗi tải giao dịch:", err);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, limit, filters, selectedBuId, buLoaded, dateRestored]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchTransactions(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchTransactions]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/transactions/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Lỗi xóa giao dịch");
      fetchTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi xóa giao dịch");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  const filterConfigs: FilterConfig[] = [
    { key: "date", label: "Thời gian", type: "date-range" },
    { key: "bankReference", label: "Tham chiếu", type: "search", placeholder: "Tìm mã tham chiếu..." },
    { key: "type", label: "Loại giao dịch", type: "select", options: TYPE_OPTIONS },
    { key: "paymentMethod", label: "Phương thức", type: "select", options: METHOD_OPTIONS },
    {
      key: "expenseTypeId",
      label: "Loại chi phí",
      type: "select",
      options: expenseTypes.map((e) => ({ value: e.id, label: e.name })),
    },
  ];

  const columns: Column<Transaction>[] = [
    {
      key: "transactionDate",
      label: "Ngày",
      sortable: true,
      render: (v) => new Date(v).toLocaleDateString("vi-VN"),
    },
    {
      key: "type",
      label: "Loại",
      render: (v) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          v === "RECEIPT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}>
          {v === "RECEIPT" ? "Thu" : "Chi"}
        </span>
      ),
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
      render: (v) => <CurrencyAmount amount={v} currencyCode="VND" currencySymbol="₫" />,
    },
    {
      key: "paymentMethod",
      label: "Phương thức",
      render: (v) => v === "BANK" ? "Ngân hàng" : "Cọc",
    },
    {
      key: "expenseType",
      label: "Loại chi phí",
      render: (_: unknown, row: Transaction) => row.expenseType?.name ?? "—",
    },
    {
      key: "bankReference",
      label: "Tham chiếu",
      render: (v) => v ?? "—",
    },
    {
      key: "businessUnit",
      label: "Đơn vị",
      render: (_, row) => row.businessUnit?.code ?? "—",
    },
    {
      key: "actions",
      label: "",
      render: (_: unknown, row: Transaction) => {
        const canEdit = row.type === "RECEIPT" ? canEditReceipt : canEditPayment;
        const canDelete = row.type === "RECEIPT" ? canDeleteReceipt : canDeletePayment;
        if (!canEdit && !canDelete) return null;
        return (
          <div className="flex items-center gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                onClick={(e) => { e.stopPropagation(); setEditingTx(row as EditableTransaction); }}
              >
                <PencilIcon className="size-4" />
              </Button>
            )}
            {canDelete && (
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
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Giao dịch</h1>
        {canCreateAny && (
          <Button onClick={() => router.push("/transactions/new")} size="sm">
            <PlusIcon className="size-4 mr-1.5" />
            Thêm giao dịch
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      <FilterBar
        filters={filterConfigs}
        onFilterChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
        values={filters}
      />
      <DateQuickPresets onSelect={(from, to) => {
        setFilters((prev) => ({ ...prev, dateFrom: from, dateTo: to }));
      }} />

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={transactions as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Không có giao dịch nào"
      />

      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />

      {/* Edit dialog */}
      <TransactionEditDialog
        open={!!editingTx}
        onClose={() => setEditingTx(null)}
        onSuccess={fetchTransactions}
        transaction={editingTx}
      />

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={!!deleteId}
        title="Xóa giao dịch"
        description="Giao dịch này sẽ bị xóa vĩnh viễn. Bạn có chắc chắn?"
        variant="danger"
        confirmLabel={deleting ? "Đang xóa..." : "Xóa"}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

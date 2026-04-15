// Order list page — SALE/PURCHASE tabs with FilterBar, DataTable, Pagination
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyAmount } from "@/components/shared/currency-amount";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { PlusIcon } from "lucide-react";

interface Order extends Record<string, unknown> {
  id: string;
  type: string;
  status: string;
  orderNumber: string;
  orderDate: string;
  amountOriginal: string;
  party: { id: string; name: string };
  currency: { id: string; code: string; symbol: string };
  businessUnit: { id: string; code: string; name: string };
  expenseType: { id: string; name: string; isActive: boolean } | null;
}

const STATUS_OPTIONS = [
  { value: "UNPAID", label: "Chưa TT" },
  { value: "PARTIAL_PAID", label: "TT 1 phần" },
  { value: "PAID", label: "Đã TT" },
  { value: "PARTIAL_REFUNDED", label: "Hoàn 1 phần" },
  { value: "REFUNDED", label: "Đã hoàn" },
];

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedBuId } = useSelectedBu();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  // Read initial type filter from URL search params (e.g. /orders?type=SALE)
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const type = searchParams.get("type");
    return type ? { type } : ({} as Record<string, string>);
  });

  // Sync type filter when URL search params change (soft navigation between sidebar links)
  const urlType = searchParams.get("type");
  useEffect(() => {
    setFilters((prev) => {
      if (urlType && prev.type !== urlType) return { ...prev, type: urlType };
      if (!urlType && prev.type) { const { type: _, ...rest } = prev; return rest; }
      return prev;
    });
    setPage(1);
  }, [urlType]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(selectedBuId ? { businessUnitId: selectedBuId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.expenseTypeId ? { expenseTypeId: filters.expenseTypeId } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
      });
      const res = await fetch(`/api/orders?${params}`);
      const json = await res.json();
      if (json.success) {
        setOrders(json.data);
        setTotal(json.pagination?.total ?? 0);
      }
    } catch (err) {
      console.error("Lỗi tải đơn hàng:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters, selectedBuId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  // Load expense types for filter (only fetched; combobox shown only on PURCHASE)
  const [expenseTypes, setExpenseTypes] = useState<
    Array<{ id: string; name: string; isActive: boolean }>
  >([]);
  useEffect(() => {
    if (urlType === "PURCHASE") {
      fetch("/api/expense-types")
        .then((r) => r.json())
        .then((json) => { if (json.success) setExpenseTypes(json.data); })
        .catch(console.error);
    }
  }, [urlType]);

  // Type is locked via URL (sidebar menu): no type filter, no type column needed.
  // Expense-type filter only on PURCHASE.
  const filterConfigs: FilterConfig[] = [
    { key: "status", label: "Trạng thái", type: "select", options: STATUS_OPTIONS },
    ...(urlType === "PURCHASE"
      ? [
          {
            key: "expenseTypeId",
            label: "Loại chi phí",
            type: "select" as const,
            options: expenseTypes
              .filter((e) => e.isActive)
              .map((e) => ({ value: e.id, label: e.name })),
          },
        ]
      : []),
    { key: "date", label: "Ngày đặt", type: "date-range" },
  ];

  const columns: Column<Order>[] = [
    {
      key: "orderNumber",
      label: "Số đơn",
      sortable: true,
      render: (v) => <span className="font-medium text-slate-800">{String(v ?? "—")}</span>,
    },
    {
      key: "orderDate",
      label: "Ngày",
      sortable: true,
      render: (v) => new Date(v).toLocaleDateString("vi-VN"),
    },
    {
      key: "party",
      label: "Đối tác",
      render: (_, row) => row.party?.name ?? "—",
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
      key: "status",
      label: "Trạng thái",
      render: (v) => <StatusBadge status={v} />,
    },
    // Show expense type column only for PURCHASE list
    ...(urlType === "PURCHASE"
      ? [
          {
            key: "expenseType",
            label: "Loại chi phí",
            render: (_: unknown, row: Order) => row.expenseType?.name ?? "—",
          } as Column<Order>,
        ]
      : []),
    {
      key: "businessUnit",
      label: "Đơn vị",
      render: (_, row) => row.businessUnit?.code ?? "—",
    },
  ];

  const pageTitle = urlType === "SALE" ? "Đơn bán" : urlType === "PURCHASE" ? "Đơn mua" : "Đơn hàng";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">{pageTitle}</h1>
        <Button
          onClick={() =>
            router.push(urlType ? `/orders/new?type=${urlType}` : "/orders/new")
          }
          size="sm"
        >
          <PlusIcon className="size-4 mr-1.5" />
          Tạo đơn
        </Button>
      </div>

      <FilterBar filters={filterConfigs} onFilterChange={handleFilterChange} values={filters} />

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={orders as unknown as Record<string, unknown>[]}
        onRowClick={(row) => router.push(`/orders/${(row as unknown as Order).id}`)}
        loading={loading}
        emptyMessage="Không có đơn hàng nào"
      />

      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />
    </div>
  );
}

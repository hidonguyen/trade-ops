// Order list page — SALE/PURCHASE tabs with FilterBar, DataTable, Pagination
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getDefaultBu } from "@/lib/utils";
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
  orderDate: string;
  amountOriginal: string;
  party: { id: string; name: string };
  currency: { id: string; code: string; symbol: string };
  businessUnit: { id: string; code: string; name: string };
}

const STATUS_OPTIONS = [
  { value: "UNPAID", label: "Chưa TT" },
  { value: "PARTIAL_PAID", label: "TT 1 phần" },
  { value: "PAID", label: "Đã TT" },
  { value: "PARTIAL_REFUNDED", label: "Hoàn 1 phần" },
  { value: "REFUNDED", label: "Đã hoàn" },
];

const TYPE_OPTIONS = [
  { value: "SALE", label: "Bán hàng" },
  { value: "PURCHASE", label: "Mua hàng" },
];

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      const buId = getDefaultBu();
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(buId ? { businessUnitId: buId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {}),
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
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  const filterConfigs: FilterConfig[] = [
    { key: "type", label: "Loại đơn", type: "select", options: TYPE_OPTIONS },
    { key: "status", label: "Trạng thái", type: "select", options: STATUS_OPTIONS },
    { key: "date", label: "Ngày đặt", type: "date-range" },
  ];

  const columns: Column<Order>[] = [
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
      key: "type",
      label: "Loại",
      render: (v) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          v === "SALE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
        }`}>
          {v === "SALE" ? "Bán" : "Mua"}
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
      key: "status",
      label: "Trạng thái",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "businessUnit",
      label: "Đơn vị",
      render: (_, row) => row.businessUnit?.code ?? "—",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Đơn hàng</h1>
        <Button onClick={() => router.push("/orders/new")} size="sm">
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

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
import { DateQuickPresets, getThisWeekRange } from "@/components/shared/date-quick-presets";
import { PlusIcon } from "lucide-react";
import Decimal from "decimal.js";

interface Order extends Record<string, unknown> {
  id: string;
  type: string;
  status: string;
  orderNumber: string;
  orderDate: string;
  amountOriginal: string;
  paidAmount: string;
  refundedAmount: string;
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
  // Read initial type + partyId filters from URL search params
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const type = searchParams.get("type");
    const partyId = searchParams.get("partyId");
    const weekRange = getThisWeekRange();
    return {
      ...weekRange,
      ...(type ? { type } : {}),
      ...(partyId ? { partyId } : {}),
    };
  });

  // Sync URL-driven filters (soft navigation from sidebar / party detail)
  const urlType = searchParams.get("type");
  const urlPartyId = searchParams.get("partyId");
  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev };
      if (urlType) next.type = urlType; else delete next.type;
      if (urlPartyId) next.partyId = urlPartyId; else delete next.partyId;
      return next;
    });
    setPage(1);
  }, [urlType, urlPartyId]);

  // Fetch party name when filtered by party (for indicator bar)
  const [filteredParty, setFilteredParty] = useState<{ name: string } | null>(null);
  useEffect(() => {
    if (!urlPartyId) { setFilteredParty(null); return; }
    fetch(`/api/parties/${urlPartyId}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setFilteredParty({ name: json.data.name }); })
      .catch(() => setFilteredParty(null));
  }, [urlPartyId]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(selectedBuId ? { businessUnitId: selectedBuId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.partyId ? { partyId: filters.partyId } : {}),
        ...(filters.orderNumber ? { orderNumber: filters.orderNumber } : {}),
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

  // Load parties scoped to current page type (SALE→CUSTOMER, PURCHASE→SUPPLIER)
  const [parties, setParties] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (!urlType) { setParties([]); return; }
    const partyType = urlType === "SALE" ? "CUSTOMER" : "SUPPLIER";
    fetch(`/api/parties?type=${partyType}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setParties(json.data); })
      .catch(console.error);
  }, [urlType]);

  // Filter order: date-range → số đơn → đối tác → trạng thái → loại chi phí (PURCHASE only)
  const filterConfigs: FilterConfig[] = [
    { key: "date", label: "Ngày đặt", type: "date-range" },
    { key: "orderNumber", label: "Số đơn", type: "search", placeholder: "Tìm số đơn..." },
    {
      key: "partyId",
      label: "Đối tác",
      type: "select",
      options: parties.map((p) => ({ value: p.id, label: p.name })),
    },
    { key: "status", label: "Trạng thái TT", type: "select", options: STATUS_OPTIONS },
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
      label: "Giá trị đơn hàng",
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
      key: "paidAmount",
      label: "Đã thanh toán",
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
      key: "balance",
      label: "Còn phải TT",
      align: "right",
      render: (_, row) => {
        // Còn phải TT = (orderAmount - refunded) - (paid - refunded) = orderAmount - paid
        const orderAmt = new Decimal(row.amountOriginal ?? "0");
        const paid = new Decimal(row.paidAmount ?? "0");
        const balance = Decimal.max(orderAmt.minus(paid), new Decimal(0));
        return (
          <span className={balance.greaterThan(0) ? "text-red-600 font-medium" : "text-green-600"}>
            <CurrencyAmount
              amount={balance.toDecimalPlaces(4).toString()}
              currencyCode={row.currency?.code ?? "VND"}
              currencySymbol={row.currency?.symbol ?? "₫"}
            />
          </span>
        );
      },
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

      {filteredParty && (
        <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded px-3 py-2">
          <span className="text-slate-700">
            Đang lọc theo đối tác: <strong>{filteredParty.name}</strong>
          </span>
          <button
            type="button"
            onClick={() => router.push(urlType ? `/orders?type=${urlType}` : "/orders")}
            className="ml-auto text-blue-600 hover:text-blue-800 text-xs"
          >
            Bỏ lọc ×
          </button>
        </div>
      )}

      <FilterBar filters={filterConfigs} onFilterChange={handleFilterChange} values={filters} />
      <DateQuickPresets onSelect={(from, to) => {
        setFilters((prev) => ({ ...prev, dateFrom: from, dateTo: to }));
        setPage(1);
      }} />

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

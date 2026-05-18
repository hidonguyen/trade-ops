// Order list page — SALE/PURCHASE tabs with FilterBar, DataTable, Pagination
"use client";

import { useState, useEffect, useCallback } from "react";
import { useCan } from "@/components/providers/roles-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyAmount } from "@/components/shared/currency-amount";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { DateQuickPresets } from "@/components/shared/date-quick-presets";
import { getInitialDateRange, usePersistDateRange, useRestorePersistedDateRange } from "@/components/shared/use-persisted-date-range";
import { PlusIcon, FileSpreadsheetIcon } from "lucide-react";
import Decimal from "decimal.js";

interface Order extends Record<string, unknown> {
  id: string;
  type: string;
  status: string;
  orderNumber: string;
  orderDate: string;
  paymentDueDate: string | null;
  amountOriginal: string;
  paidAmount: string;
  refundedAmount: string;
  // adjustmentTotal: signed sum of ORDER_ADJUSTMENT transactions (from list API, phase 03)
  adjustmentTotal?: string;
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
  const { selectedBuId, isLoaded: buLoaded } = useSelectedBu();
  const orderModuleEarly = searchParams.get("type") === "PURCHASE" ? "PURCHASE" : "SALE";
  const canCreate = useCan("CREATE", orderModuleEarly, selectedBuId ?? null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  // Read initial type + partyId filters from URL search params; date range restored from localStorage.
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const type = searchParams.get("type");
    const partyId = searchParams.get("partyId");
    return {
      ...getInitialDateRange("orders"),
      ...(type ? { type } : {}),
      ...(partyId ? { partyId } : {}),
    };
  });
  const dateRestored = useRestorePersistedDateRange("orders", (range) => {
    setFilters((prev) => ({ ...prev, ...range }));
  });
  usePersistDateRange("orders", filters.dateFrom, filters.dateTo);

  // Sync URL-driven filters (soft navigation from sidebar / party detail)
  const urlType = searchParams.get("type");
  const urlPartyId = searchParams.get("partyId");
  useEffect(() => {
    const applyUrl = (prev: Record<string, string>) => {
      const next = { ...prev };
      if (urlType) next.type = urlType; else delete next.type;
      if (urlPartyId) next.partyId = urlPartyId; else delete next.partyId;
      return next;
    };
    setFilters(applyUrl);
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

  const fetchOrders = useCallback(async (signal?: AbortSignal) => {
    // Gate on BU provider readiness and date restore — otherwise first request omits
    // businessUnitId or fires before persisted date range is applied.
    if (!buLoaded || !selectedBuId || !dateRestored) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        businessUnitId: selectedBuId,
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.partyId ? { partyId: filters.partyId } : {}),
        ...(filters.orderNumber ? { orderNumber: filters.orderNumber } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.expenseTypeId ? { expenseTypeId: filters.expenseTypeId } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
      });
      const res = await fetch(`/api/orders?${params}`, { signal });
      if (signal?.aborted) return;
      const json = await res.json();
      if (json.success) {
        setOrders(json.data);
        setTotal(json.pagination?.total ?? 0);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Lỗi tải đơn hàng:", err);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, limit, filters, selectedBuId, buLoaded, dateRestored]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchOrders(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchOrders]);

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

  // Load parties scoped to current page type (SALE→CUSTOMER, PURCHASE→SUPPLIER) + selected BU
  const [parties, setParties] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (!urlType || !buLoaded || !selectedBuId) { setParties([]); return; }
    const partyType = urlType === "SALE" ? "CUSTOMER" : "SUPPLIER";
    fetch(`/api/parties?type=${partyType}&businessUnitId=${selectedBuId}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setParties(json.data); })
      .catch(console.error);
  }, [urlType, selectedBuId, buLoaded]);

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
      key: "paymentDueDate",
      label: "Hạn TT",
      render: (v) =>
        v ? new Date(v).toLocaleDateString("vi-VN") : <span className="text-slate-400">—</span>,
    },
    {
      key: "party",
      label: "Đối tác",
      render: (_, row) => row.party?.name ?? "—",
    },
    {
      key: "amountOriginal",
      // Display effective value = base + adjustment; tooltip shows breakdown when adjusted
      label: "Giá trị đơn hàng",
      align: "right",
      render: (_, row) => {
        const base = new Decimal(row.amountOriginal ?? "0");
        const adj = new Decimal(row.adjustmentTotal ?? "0");
        const eff = base.plus(adj);
        const tooltip = !adj.isZero()
          ? `Gốc: ${base.toNumber().toLocaleString("vi-VN")} | Điều chỉnh: ${adj.gte(0) ? "+" : ""}${adj.toNumber().toLocaleString("vi-VN")}`
          : undefined;
        return (
          <span title={tooltip}>
            <CurrencyAmount
              amount={eff.toFixed(4)}
              currencyCode={row.currency?.code ?? "VND"}
              currencySymbol={row.currency?.symbol ?? "₫"}
            />
          </span>
        );
      },
    },
    {
      key: "paidAmount",
      // Display net paid = paid - refunded; tooltip shows breakdown when refunded
      label: "Đã thanh toán",
      align: "right",
      render: (_, row) => {
        const paid = new Decimal(row.paidAmount ?? "0");
        const refunded = new Decimal(row.refundedAmount ?? "0");
        const net = paid.minus(refunded);
        const tooltip = !refunded.isZero()
          ? `Đã TT: ${paid.toNumber().toLocaleString("vi-VN")} − Hoàn: ${refunded.toNumber().toLocaleString("vi-VN")}`
          : undefined;
        return (
          <span title={tooltip}>
            <CurrencyAmount
              amount={net.toFixed(4)}
              currencyCode={row.currency?.code ?? "VND"}
              currencySymbol={row.currency?.symbol ?? "₫"}
            />
          </span>
        );
      },
    },
    {
      key: "balance",
      label: "Còn phải TT",
      align: "right",
      render: (_, row) => {
        // Effective = orderAmount + adjustmentTotal (signed); balance = effective - paid
        const orderAmt = new Decimal(row.amountOriginal ?? "0");
        const adjustment = new Decimal(row.adjustmentTotal ?? "0");
        const paid = new Decimal(row.paidAmount ?? "0");
        const refunded = new Decimal(row.refundedAmount ?? "0");
        const effective = orderAmt.plus(adjustment);
        const balance = Decimal.max(effective.minus(paid).plus(refunded), new Decimal(0));
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

  // Build export URL for order reports using applied filters
  function buildExportUrl(
    kind: "sales-summary" | "sales-detail" | "purchase-summary" | "purchase-detail"
  ): string {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (selectedBuId) params.set("businessUnitId", selectedBuId);
    return `/api/reports/${kind}/export?${params.toString()}`;
  }

  const exportDisabled = !filters.dateFrom || !filters.dateTo;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">{pageTitle}</h1>
        <div className="flex items-center gap-2">
          {urlType === "SALE" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={exportDisabled}
                onClick={() => window.open(buildExportUrl("sales-summary"), "_blank")}
                title={exportDisabled ? "Chọn khoảng ngày để xuất" : undefined}
              >
                <FileSpreadsheetIcon className="size-4 mr-1.5" />
                Xuất tổng hợp Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={exportDisabled}
                onClick={() => window.open(buildExportUrl("sales-detail"), "_blank")}
                title={exportDisabled ? "Chọn khoảng ngày để xuất" : undefined}
              >
                <FileSpreadsheetIcon className="size-4 mr-1.5" />
                Xuất chi tiết Excel
              </Button>
            </>
          )}
          {urlType === "PURCHASE" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={exportDisabled}
                onClick={() => window.open(buildExportUrl("purchase-summary"), "_blank")}
                title={exportDisabled ? "Chọn khoảng ngày để xuất" : undefined}
              >
                <FileSpreadsheetIcon className="size-4 mr-1.5" />
                Xuất tổng hợp Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={exportDisabled}
                onClick={() => window.open(buildExportUrl("purchase-detail"), "_blank")}
                title={exportDisabled ? "Chọn khoảng ngày để xuất" : undefined}
              >
                <FileSpreadsheetIcon className="size-4 mr-1.5" />
                Xuất chi tiết Excel
              </Button>
            </>
          )}
          {canCreate && (
            <Button
              onClick={() =>
                router.push(urlType ? `/orders/new?type=${urlType}` : "/orders/new")
              }
              size="sm"
            >
              <PlusIcon className="size-4 mr-1.5" />
              Tạo đơn
            </Button>
          )}
        </div>
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

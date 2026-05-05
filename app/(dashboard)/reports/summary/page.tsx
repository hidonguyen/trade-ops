// Summary report — 4 tabs: Thu từ KH, Thu khác, Chi trả NCC, Chi khác
// Order tabs show debt tracking (nợ cũ → TT lần này → nợ còn lại)
"use client";

import { useState, useEffect, useCallback } from "react";
import { DownloadIcon, TableIcon } from "lucide-react";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { DateQuickPresets } from "@/components/shared/date-quick-presets";
import { getInitialDateRange, usePersistDateRange, useRestorePersistedDateRange } from "@/components/shared/use-persisted-date-range";
import { DataTable, Column } from "@/components/shared/data-table";
import { CurrencyAmount } from "@/components/shared/currency-amount";
import { OrderLinkCell } from "@/components/reports/order-link-cell";

interface OrderDebtRow extends Record<string, unknown> {
  orderId: string;
  partyName: string;
  orderNumber: string;
  orderDate: string;
  currencyCode: string;
  currencySymbol: string;
  priorDebt: string;
  periodPayment: string;
  remainingDebt: string;
  notes: string | null;
}

interface StandaloneRow extends Record<string, unknown> {
  rowType: "transaction" | "deposit" | "bankFee" | "refund";
  id: string;
  date: string;
  amountOriginal: string;
  currencyCode: string;
  currencySymbol: string;
  paymentMethod: string | null;
  bankReference: string | null;
  partyName: string | null;
  label: string;
  notes: string | null;
  orderId: string | null;
}

interface SummaryData {
  customerReceipts: OrderDebtRow[];
  otherReceipts: StandaloneRow[];
  supplierPayments: OrderDebtRow[];
  otherPayments: StandaloneRow[];
}

type TabKey = "customerReceipts" | "otherReceipts" | "supplierPayments" | "otherPayments";

const TABS: { key: TabKey; label: string; isOrder: boolean }[] = [
  { key: "customerReceipts", label: "Thu từ khách hàng", isOrder: true },
  { key: "otherReceipts", label: "Thu khác", isOrder: false },
  { key: "supplierPayments", label: "Chi trả nhà cung cấp", isOrder: true },
  { key: "otherPayments", label: "Chi khác", isOrder: false },
];

const ORDER_COLUMNS: Column<OrderDebtRow>[] = [
  {
    key: "index",
    label: "STT",
    render: (_: unknown, __: OrderDebtRow, idx?: number) => (idx ?? 0) + 1,
  },
  {
    key: "partyName",
    label: "Đối tác",
  },
  {
    key: "orderNumber",
    label: "Mã đơn",
  },
  {
    key: "orderDate",
    label: "Ngày đơn",
    render: (v) => new Date(v).toLocaleDateString("vi-VN"),
  },
  {
    key: "priorDebt",
    label: "Nợ cũ",
    align: "right",
    render: (v, row) => (
      <CurrencyAmount amount={v} currencyCode={row.currencyCode} currencySymbol={row.currencySymbol} />
    ),
  },
  {
    key: "periodPayment",
    label: "TT lần này",
    align: "right",
    render: (v, row) => {
      const num = parseFloat(v as string);
      const cls = num < 0 ? "text-red-600 font-medium" : "text-green-700 font-medium";
      return (
        <span className={cls}>
          <CurrencyAmount amount={v} currencyCode={row.currencyCode} currencySymbol={row.currencySymbol} />
        </span>
      );
    },
  },
  {
    key: "remainingDebt",
    label: "Nợ còn lại",
    align: "right",
    render: (v, row) => {
      const remaining = parseFloat(v);
      return (
        <span className={remaining > 0 ? "text-red-600 font-medium" : "text-green-600"}>
          <CurrencyAmount amount={v} currencyCode={row.currencyCode} currencySymbol={row.currencySymbol} />
        </span>
      );
    },
  },
  {
    key: "notes",
    label: "Ghi chú",
    render: (v) => v ?? "—",
  },
  {
    key: "orderId",
    label: "",
    align: "center",
    render: (v) => <OrderLinkCell orderId={v as string | null} />,
  },
];

const STANDALONE_COLUMNS: Column<StandaloneRow>[] = [
  {
    key: "index",
    label: "STT",
    render: (_: unknown, __: StandaloneRow, idx?: number) => (idx ?? 0) + 1,
  },
  {
    key: "date",
    label: "Ngày",
    render: (v) => new Date(v as string).toLocaleDateString("vi-VN"),
  },
  {
    key: "partyName",
    label: "Đối tác",
    render: (v) => (v as string | null) ?? "—",
  },
  {
    key: "amountOriginal",
    label: "Số tiền",
    align: "right",
    render: (v, row) => (
      <CurrencyAmount amount={v} currencyCode={row.currencyCode} currencySymbol={row.currencySymbol} />
    ),
  },
  {
    key: "currencyCode",
    label: "Tiền tệ",
  },
  {
    key: "label",
    label: "Loại",
    render: (v, row) => {
      const text = (v as string) || "—";
      if (row.rowType === "bankFee") return <span className="text-red-600">{text}</span>;
      if (row.rowType === "deposit") return <span className="text-blue-600">{text}</span>;
      if (row.rowType === "refund") return <span className="text-orange-600">{text}</span>;
      return text;
    },
  },
  {
    key: "paymentMethod",
    label: "Phương thức",
    render: (v) => {
      if (v === null || v === undefined) return "—";
      if (v === "BANK") return "Ngân hàng";
      if (v === "DEPOSIT") return "Cọc";
      return v as string;
    },
  },
  {
    key: "bankReference",
    label: "Tham chiếu",
    render: (v) => (v as string | null) ?? "—",
  },
  {
    key: "notes",
    label: "Ghi chú",
    render: (v) => (v as string | null) ?? "—",
  },
  {
    key: "orderId",
    label: "",
    align: "center",
    render: (v) => <OrderLinkCell orderId={v as string | null} />,
  },
];

function exportToCsv(data: Record<string, unknown>[], columns: { key: string; label: string }[], tabLabel: string) {
  const header = columns.map((c) => c.label).join(",");
  const rows = data.map((r) => columns.map((c) => String(r[c.key] ?? "")).join(","));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bao-cao-${tabLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsSummaryPage() {
  const { selectedBuId, isLoaded: buLoaded } = useSelectedBu();
  const [filters, setFilters] = useState<Record<string, string>>(() => ({
    ...getInitialDateRange("summary"),
  }));
  const dateRestored = useRestorePersistedDateRange("summary", (range) => {
    setFilters((prev) => ({ ...prev, ...range }));
  });
  usePersistDateRange("summary", filters.dateFrom, filters.dateTo);
  const [activeTab, setActiveTab] = useState<TabKey>("customerReceipts");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (signal?: AbortSignal) => {
    if (!buLoaded || !selectedBuId || !dateRestored) return;
    if (!filters.dateFrom || !filters.dateTo) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        businessUnitId: selectedBuId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
      const res = await fetch(`/api/reports/summary?${params}`, { signal });
      if (signal?.aborted) return;
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.message ?? "Lỗi không xác định");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Lỗi kết nối máy chủ");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [buLoaded, selectedBuId, dateRestored, filters]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchSummary(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchSummary]);

  const filterConfigs: FilterConfig[] = [
    { key: "dateFrom", label: "Từ ngày", type: "date" },
    { key: "dateTo", label: "Đến ngày", type: "date" },
  ];

  const activeTabInfo = TABS.find((t) => t.key === activeTab)!;
  const tabData = data ? data[activeTab] : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo cáo tổng hợp</h1>
          <p className="mt-0.5 text-sm text-slate-500">Tổng hợp thu chi theo kỳ</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!filters.dateFrom || !filters.dateTo}
          onClick={() => {
            const params = new URLSearchParams({ dateFrom: filters.dateFrom, dateTo: filters.dateTo });
            window.open(`/api/reports/summary/export?${params}`, "_blank");
          }}
        >
          <TableIcon className="size-4 mr-1.5" />
          Xuất báo cáo tổng hợp (Excel)
        </Button>
      </div>

      <FilterBar
        filters={filterConfigs}
        onFilterChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
        values={filters}
      />
      <DateQuickPresets onSelect={(from, to) => {
        setFilters((prev) => ({ ...prev, dateFrom: from, dateTo: to }));
      }} />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
      )}

      {/* Tab pills */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-blue-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.label}
            {data && <span className="ml-1.5 opacity-70">({(data[tab.key] as unknown[]).length})</span>}
          </button>
        ))}
      </div>

      {/* Table + export */}
      <div className="space-y-3">
        {activeTabInfo.isOrder ? (
          <DataTable
            columns={ORDER_COLUMNS as unknown as Column<Record<string, unknown>>[]}
            data={tabData as unknown as Record<string, unknown>[]}
            loading={loading}
            emptyMessage="Không có dữ liệu trong kỳ này"
          />
        ) : (
          <DataTable
            columns={STANDALONE_COLUMNS as unknown as Column<Record<string, unknown>>[]}
            data={tabData as unknown as Record<string, unknown>[]}
            loading={loading}
            emptyMessage="Không có dữ liệu trong kỳ này"
          />
        )}
      </div>
    </div>
  );
}

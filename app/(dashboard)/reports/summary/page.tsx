// Summary report — 4 tabs: Thu từ KH, Thu khác, Chi trả NCC, Chi khác
// Order tabs show debt tracking (nợ cũ → TT lần này → nợ còn lại)
"use client";

import { useState, useEffect, useCallback } from "react";
import { DownloadIcon, FileTextIcon } from "lucide-react";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { DateQuickPresets, getThisWeekRange } from "@/components/shared/date-quick-presets";
import { DataTable, Column } from "@/components/shared/data-table";
import { CurrencyAmount } from "@/components/shared/currency-amount";

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
  id: string;
  transactionDate: string;
  amountOriginal: string;
  currencyCode: string;
  currencySymbol: string;
  paymentMethod: string;
  bankReference: string | null;
  notes: string | null;
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
    render: (v, row) => (
      <span className="text-green-700 font-medium">
        <CurrencyAmount amount={v} currencyCode={row.currencyCode} currencySymbol={row.currencySymbol} />
      </span>
    ),
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
];

const STANDALONE_COLUMNS: Column<StandaloneRow>[] = [
  {
    key: "index",
    label: "STT",
    render: (_: unknown, __: StandaloneRow, idx?: number) => (idx ?? 0) + 1,
  },
  {
    key: "transactionDate",
    label: "Ngày",
    render: (v) => new Date(v).toLocaleDateString("vi-VN"),
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
    key: "paymentMethod",
    label: "Phương thức",
    render: (v) => v === "BANK" ? "Ngân hàng" : "Cọc",
  },
  {
    key: "bankReference",
    label: "Tham chiếu",
    render: (v) => v ?? "—",
  },
  {
    key: "notes",
    label: "Ghi chú",
    render: (v) => v ?? "—",
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
  const { selectedBuId } = useSelectedBu();
  const [filters, setFilters] = useState<Record<string, string>>(getThisWeekRange);
  const [activeTab, setActiveTab] = useState<TabKey>("customerReceipts");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (f: Record<string, string>) => {
    if (!selectedBuId || !f.dateFrom || !f.dateTo) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        businessUnitId: selectedBuId,
        dateFrom: f.dateFrom,
        dateTo: f.dateTo,
      });
      const res = await fetch(`/api/reports/summary?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.message ?? "Lỗi không xác định");
    } catch {
      setError("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }, [selectedBuId]);

  useEffect(() => { fetchSummary(filters); }, [filters, fetchSummary]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

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
          <FileTextIcon className="size-4 mr-1.5" />
          Xuất báo cáo tổng hợp
        </Button>
      </div>

      <FilterBar filters={filterConfigs} onFilterChange={handleFilterChange} values={filters} />
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
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">{activeTabInfo.label}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const cols = activeTabInfo.isOrder
                ? ORDER_COLUMNS.filter((c) => c.key !== "index")
                : STANDALONE_COLUMNS.filter((c) => c.key !== "index");
              exportToCsv(tabData as Record<string, unknown>[], cols, activeTabInfo.label);
            }}
            disabled={tabData.length === 0}
          >
            <DownloadIcon className="size-4 mr-1.5" />
            Xuất CSV
          </Button>
        </div>

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

// Summary report — tabbed view (Tổng thu / Tổng chi / Phải thu / Phải trả) with FilterBar, DataTable, CSV export
"use client";

import { useState, useEffect, useCallback } from "react";
import { DownloadIcon } from "lucide-react";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { DataTable, Column } from "@/components/shared/data-table";

interface CurrencySummary {
  code: string;
  symbol: string;
  total: string;
}

interface SummaryData {
  totalSales: CurrencySummary[];
  totalPurchases: CurrencySummary[];
  totalReceivable: CurrencySummary[];
  totalPayable: CurrencySummary[];
}

type TabKey = "sales" | "purchases" | "receivable" | "payable";

const TABS: { key: TabKey; label: string }[] = [
  { key: "sales", label: "Tổng thu" },
  { key: "purchases", label: "Tổng chi" },
  { key: "receivable", label: "Phải thu" },
  { key: "payable", label: "Phải trả" },
];

interface TableRow extends Record<string, unknown> {
  code: string;
  symbol: string;
  total: string;
}

const COLUMNS: Column<TableRow>[] = [
  { key: "code", label: "Tiền tệ", sortable: true },
  {
    key: "total",
    label: "Số tiền",
    align: "right",
    sortable: true,
    render: (val, row) =>
      `${row.symbol}${parseFloat(String(val)).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}`,
  },
];

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
  };
}

function exportToCsv(data: TableRow[], tabLabel: string) {
  const header = "Tiền tệ,Số tiền";
  const rows = data.map((r) => `${r.code},${r.total}`);
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
  const defaults = getDefaultDateRange();
  const [filters, setFilters] = useState<Record<string, string>>({
    dateFrom: defaults.dateFrom,
    dateTo: defaults.dateTo,
  });
  const [activeTab, setActiveTab] = useState<TabKey>("sales");
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
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
      if (json.success) {
        setSummaryData(json.data);
      } else {
        setError(json.message ?? "Lỗi không xác định");
      }
    } catch {
      setError("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }, [selectedBuId]);

  useEffect(() => {
    fetchSummary(filters);
  }, [filters, fetchSummary]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const filterConfigs: FilterConfig[] = [
    { key: "dateFrom", label: "Từ ngày", type: "date" },
    { key: "dateTo", label: "Đến ngày", type: "date" },
  ];

  function getTabData(): TableRow[] {
    if (!summaryData) return [];
    const map: Record<TabKey, CurrencySummary[]> = {
      sales: summaryData.totalSales,
      purchases: summaryData.totalPurchases,
      receivable: summaryData.totalReceivable,
      payable: summaryData.totalPayable,
    };
    return (map[activeTab] ?? []) as TableRow[];
  }

  const tabData = getTabData();
  const activeTabLabel = TABS.find((t) => t.key === activeTab)?.label ?? activeTab;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Báo cáo tổng hợp</h1>
        <p className="mt-0.5 text-sm text-slate-500">Tổng hợp thu chi theo kỳ</p>
      </div>

      <FilterBar filters={filterConfigs} onFilterChange={handleFilterChange} values={filters} />

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
          </button>
        ))}
      </div>

      {/* Table + export */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">{activeTabLabel}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCsv(tabData, activeTabLabel)}
            disabled={tabData.length === 0}
          >
            <DownloadIcon className="size-4 mr-1.5" />
            Xuất Excel
          </Button>
        </div>
        <DataTable<TableRow>
          columns={COLUMNS}
          data={tabData}
          loading={loading}
          emptyMessage="Không có dữ liệu trong kỳ này"
          rowKey={(r) => r.code}
        />
      </div>
    </div>
  );
}

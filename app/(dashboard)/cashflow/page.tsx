// Cashflow report page — filter by BU/date/currency, summary cards, transaction table, Excel export
"use client";

import { useState, useEffect, useCallback } from "react";
import { getDefaultBu } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { CurrencyAmount } from "@/components/shared/currency-amount";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { CashflowSummaryCards } from "./cashflow-summary-cards";
import { DownloadIcon } from "lucide-react";
import Decimal from "decimal.js";

interface CashflowTransaction {
  id: string;
  type: string;
  paymentMethod: string;
  amountOriginal: string;
  amountVnd: string;
  bankReference: string | null;
  transactionDate: string;
  notes: string | null;
  currency: { id: string; code: string; symbol: string };
  businessUnit: { id: string; code: string; name: string };
}

interface CurrencySummary {
  currencyCode: string;
  currencySymbol: string;
  totalReceipts: string;
  totalPayments: string;
  netCashflow: string;
}

interface Currency { id: string; code: string; symbol: string; }

export default function CashflowPage() {
  const [transactions, setTransactions] = useState<CashflowTransaction[]>([]);
  const [summaries, setSummaries] = useState<CurrencySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/currencies")
      .then((r) => r.json())
      .then((json) => { if (json.success) setCurrencies(json.data); })
      .catch(console.error);
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const buId = getDefaultBu();
      const params = new URLSearchParams({
        format: "json",
        page: String(page),
        limit: String(limit),
        ...(buId ? { businessUnitId: buId } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        ...(filters.currencyId ? { currencyId: filters.currencyId } : {}),
      });
      const res = await fetch(`/api/cashflow-report?${params}`);
      const json = await res.json();
      if (json.success) {
        const txs: CashflowTransaction[] = json.data.transactions ?? json.data ?? [];
        setTransactions(txs);
        setTotal(json.pagination?.total ?? txs.length);
        setSummaries(computeSummaries(txs));
      }
    } catch (err) {
      console.error("Failed to fetch cashflow:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Compute per-currency summaries from transaction list
  function computeSummaries(txs: CashflowTransaction[]): CurrencySummary[] {
    const map = new Map<string, { symbol: string; receipts: Decimal; payments: Decimal }>();
    for (const tx of txs) {
      const code = tx.currency?.code ?? "VND";
      const symbol = tx.currency?.symbol ?? "₫";
      if (!map.has(code)) map.set(code, { symbol, receipts: new Decimal(0), payments: new Decimal(0) });
      const entry = map.get(code)!;
      const amt = new Decimal(tx.amountOriginal ?? "0");
      if (tx.type === "RECEIPT") entry.receipts = entry.receipts.plus(amt);
      else entry.payments = entry.payments.plus(amt);
    }
    return Array.from(map.entries()).map(([code, v]) => ({
      currencyCode: code,
      currencySymbol: v.symbol,
      totalReceipts: v.receipts.toFixed(4),
      totalPayments: v.payments.toFixed(4),
      netCashflow: v.receipts.minus(v.payments).toFixed(4),
    }));
  }

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function handleExportExcel() {
    const buId = getDefaultBu();
    const params = new URLSearchParams({
      format: "xlsx",
      ...(buId ? { businessUnitId: buId } : {}),
      ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
      ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
      ...(filters.currencyId ? { currencyId: filters.currencyId } : {}),
    });
    window.open(`/api/cashflow-report?${params}`, "_blank");
  }

  const curOptions = currencies.map((c) => ({ value: c.id, label: `${c.symbol} ${c.code}` }));

  const filterConfigs: FilterConfig[] = [
    { key: "currencyId", label: "Tiền tệ", type: "select", options: curOptions },
    { key: "dateFrom", label: "Từ ngày", type: "date" },
    { key: "dateTo", label: "Đến ngày", type: "date" },
  ];

  const columns: Column<CashflowTransaction>[] = [
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
      key: "bankReference",
      label: "Tham chiếu",
      render: (v) => v ?? "—",
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
        <h1 className="text-xl font-semibold text-slate-900">Báo cáo dòng tiền</h1>
        <Button variant="outline" size="sm" onClick={handleExportExcel}>
          <DownloadIcon className="size-4 mr-1.5" />
          Xuất Excel
        </Button>
      </div>

      <FilterBar filters={filterConfigs} onFilterChange={handleFilterChange} values={filters} />

      <CashflowSummaryCards summaries={summaries} />

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={transactions as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Không có giao dịch trong kỳ này"
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

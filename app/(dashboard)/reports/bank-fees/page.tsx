// Bank fee report page — lists all transactions with company-borne fees.
// Filters: date range, BU, currency. Shows per-currency totals + grand total VND.
"use client";

import { useState, useEffect, useCallback } from "react";
import { DownloadIcon } from "lucide-react";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { CurrencyAmount } from "@/components/shared/currency-amount";
import { Card, CardContent } from "@/components/ui/card";

interface BankFeeRow {
  id: string;
  transactionDate: string;
  businessUnitCode: string;
  partyName: string | null;
  orderNumber: string | null;
  orderId: string | null;
  type: string;
  amountOriginal: string;
  currencyCode: string;
  currencySymbol: string;
  bankFeeOriginal: string;
  bankFeeVnd: string;
  bankReference: string | null;
  notes: string | null;
}

interface ByCurrency {
  code: string;
  symbol: string;
  totalFeeOriginal: string;
  totalFeeVnd: string;
}

interface Totals {
  grandFeeVnd: string;
  byCurrency: ByCurrency[];
}

interface Currency {
  id: string;
  code: string;
  symbol: string;
}

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
  };
}

const TX_TYPE_LABEL: Record<string, string> = {
  SALE_PAYMENT: "TT bán",
  PURCHASE_PAYMENT: "TT mua",
  RECEIPT: "Thu",
  PAYMENT: "Chi",
};

export default function BankFeesReportPage() {
  const { selectedBuId } = useSelectedBu();
  const defaults = getDefaultDateRange();
  const [filters, setFilters] = useState<Record<string, string>>({
    dateFrom: defaults.dateFrom,
    dateTo: defaults.dateTo,
  });
  const [rows, setRows] = useState<BankFeeRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ grandFeeVnd: "0", byCurrency: [] });
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/currencies")
      .then((r) => r.json())
      .then((json) => { if (json.success) setCurrencies(json.data); })
      .catch(console.error);
  }, []);

  const fetchReport = useCallback(async () => {
    if (!filters.dateFrom || !filters.dateTo) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        format: "json",
        page: String(page),
        limit: String(limit),
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        ...(selectedBuId ? { businessUnitId: selectedBuId } : {}),
        ...(filters.currencyId ? { currencyId: filters.currencyId } : {}),
      });
      const res = await fetch(`/api/reports/bank-fees?${params}`);
      const json = await res.json();
      if (json.success) {
        setRows(json.data.items ?? []);
        setTotals(json.data.totals ?? { grandFeeVnd: "0", byCurrency: [] });
        setTotal(json.pagination?.total ?? 0);
      }
    } catch (err) {
      console.error("Lỗi tải báo cáo phí ngân hàng:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters, selectedBuId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function handleExportExcel() {
    const params = new URLSearchParams({
      format: "xlsx",
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      ...(selectedBuId ? { businessUnitId: selectedBuId } : {}),
      ...(filters.currencyId ? { currencyId: filters.currencyId } : {}),
    });
    window.open(`/api/reports/bank-fees?${params}`, "_blank");
  }

  const curOptions = currencies.map((c) => ({ value: c.id, label: `${c.symbol} ${c.code}` }));

  const filterConfigs: FilterConfig[] = [
    { key: "dateFrom", label: "Từ ngày", type: "date" },
    { key: "dateTo", label: "Đến ngày", type: "date" },
    { key: "currencyId", label: "Tiền tệ", type: "select", options: curOptions },
  ];

  const columns: Column<BankFeeRow>[] = [
    {
      key: "transactionDate",
      label: "Ngày",
      sortable: true,
      render: (v) => new Date(v as string).toLocaleDateString("vi-VN"),
    },
    { key: "businessUnitCode", label: "ĐVKD" },
    { key: "partyName", label: "Đối tác", render: (v) => (v as string) ?? "—" },
    { key: "orderNumber", label: "Số đơn", render: (v) => (v as string) ?? "—" },
    {
      key: "type",
      label: "Loại GD",
      render: (v) => TX_TYPE_LABEL[v as string] ?? (v as string),
    },
    {
      key: "amountOriginal",
      label: "Số tiền",
      align: "right",
      render: (v, row) => (
        <CurrencyAmount
          amount={v as string}
          currencyCode={row.currencyCode}
          currencySymbol={row.currencySymbol}
        />
      ),
    },
    {
      key: "bankFeeOriginal",
      label: "Phí (gốc)",
      align: "right",
      render: (v, row) => (
        <CurrencyAmount
          amount={v as string}
          currencyCode={row.currencyCode}
          currencySymbol={row.currencySymbol}
        />
      ),
    },
    {
      key: "bankFeeVnd",
      label: "Phí (VND)",
      align: "right",
      render: (v) => <CurrencyAmount amount={v as string} currencyCode="VND" currencySymbol="₫" />,
    },
    { key: "bankReference", label: "Tham chiếu", render: (v) => (v as string) ?? "—" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo cáo phí ngân hàng</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Các khoản phí ngân hàng do công ty chịu (không trừ vào công nợ khách hàng)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportExcel}>
          <DownloadIcon className="size-4 mr-1.5" />
          Xuất Excel
        </Button>
      </div>

      <FilterBar filters={filterConfigs} onFilterChange={handleFilterChange} values={filters} />

      {/* Totals summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
              Tổng phí (VND)
            </p>
            <CurrencyAmount
              amount={totals.grandFeeVnd}
              currencyCode="VND"
              currencySymbol="₫"
              className="text-xl font-semibold text-amber-700"
            />
          </CardContent>
        </Card>
        {totals.byCurrency.map((c) => (
          <Card key={c.code}>
            <CardContent className="pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
                Phí theo {c.code}
              </p>
              <div className="flex flex-col gap-0.5">
                <CurrencyAmount
                  amount={c.totalFeeOriginal}
                  currencyCode={c.code}
                  currencySymbol={c.symbol}
                  className="text-base font-semibold"
                />
                <span className="text-xs text-slate-500">
                  ≈{" "}
                  <CurrencyAmount
                    amount={c.totalFeeVnd}
                    currencyCode="VND"
                    currencySymbol="₫"
                    className="text-xs"
                  />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={rows as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Không có khoản phí nào trong kỳ"
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

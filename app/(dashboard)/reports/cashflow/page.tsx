// Cashflow report page — filter by BU/date/currency, summary cards, transaction table, Excel export
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { CurrencyAmount } from "@/components/shared/currency-amount";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { CashflowSummaryCards } from "./cashflow-summary-cards";
import { DateQuickPresets } from "@/components/shared/date-quick-presets";
import { getInitialDateRange, usePersistDateRange, useRestorePersistedDateRange } from "@/components/shared/use-persisted-date-range";
import { DownloadIcon } from "lucide-react";
import { OrderLinkCell } from "@/components/reports/order-link-cell";
import Decimal from "decimal.js";

interface CashflowTransaction {
  id: string;
  rowKind: "transaction" | "deposit";
  category: string;
  isMoneyIn: boolean;
  type: string;
  paymentType: string;
  paymentMethod: string;
  amountOriginal: string;
  amountVnd: string;
  bankReference: string | null;
  transactionDate: string;
  notes: string | null;
  bankFeeOriginal: string | null;
  bankFeeVnd: string | null;
  currency: { id: string; code: string; symbol: string };
  businessUnit: { id: string; code: string; name: string };
  partyName: string | null;
  expenseTypeName: string | null;
  description: string | null;
  orderId: string | null;
  orderNumber: string | null;
  createdBy: string;
}

interface CurrencySummary {
  currencyCode: string;
  currencySymbol: string;
  totalReceipts: string;
  totalPayments: string;
  netCashflow: string;
  totalBankFee: string;
  netAfterFee: string;
}

interface Currency { id: string; code: string; symbol: string; }

export default function CashflowPage() {
  const { selectedBuId, isLoaded: buLoaded } = useSelectedBu();
  const [transactions, setTransactions] = useState<CashflowTransaction[]>([]);
  const [summaries, setSummaries] = useState<CurrencySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>(() => ({
    ...getInitialDateRange("cashflow"),
  }));
  const dateRestored = useRestorePersistedDateRange("cashflow", (range) => {
    setFilters((prev) => ({ ...prev, ...range }));
  });
  usePersistDateRange("cashflow", filters.dateFrom, filters.dateTo);

  useEffect(() => {
    fetch("/api/currencies")
      .then((r) => r.json())
      .then((json) => { if (json.success) setCurrencies(json.data); })
      .catch(console.error);
  }, []);

  const fetchReport = useCallback(async (signal?: AbortSignal) => {
    if (!buLoaded || !selectedBuId || !dateRestored) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        format: "json",
        page: String(page),
        limit: String(limit),
        businessUnitId: selectedBuId,
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        ...(filters.currencyId ? { currencyId: filters.currencyId } : {}),
      });
      const res = await fetch(`/api/cashflow-report?${params}`, { signal });
      if (signal?.aborted) return;
      const json = await res.json();
      if (json.success) {
        const txs: CashflowTransaction[] = json.data.transactions ?? json.data ?? [];
        setTransactions(txs);
        setTotal(json.pagination?.total ?? txs.length);
        setSummaries(computeSummaries(txs));
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Lỗi tải dòng tiền:", err);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, limit, filters, selectedBuId, buLoaded, dateRestored]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchReport(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchReport]);

  // Compute per-currency summaries from transaction list (includes bank fee tracking)
  function computeSummaries(txs: CashflowTransaction[]): CurrencySummary[] {
    const map = new Map<
      string,
      { symbol: string; receipts: Decimal; payments: Decimal; fees: Decimal }
    >();
    for (const tx of txs) {
      const code = tx.currency?.code ?? "VND";
      const symbol = tx.currency?.symbol ?? "₫";
      if (!map.has(code))
        map.set(code, { symbol, receipts: new Decimal(0), payments: new Decimal(0), fees: new Decimal(0) });
      const entry = map.get(code)!;
      const amt = new Decimal(tx.amountOriginal ?? "0");
      if (tx.isMoneyIn) entry.receipts = entry.receipts.plus(amt);
      else entry.payments = entry.payments.plus(amt);
      if (tx.bankFeeOriginal) {
        entry.fees = entry.fees.plus(new Decimal(tx.bankFeeOriginal));
      }
    }
    return Array.from(map.entries()).map(([code, v]) => ({
      currencyCode: code,
      currencySymbol: v.symbol,
      totalReceipts: v.receipts.toFixed(4),
      totalPayments: v.payments.toFixed(4),
      netCashflow: v.receipts.minus(v.payments).toFixed(4),
      totalBankFee: v.fees.toFixed(4),
      netAfterFee: v.receipts.minus(v.payments).minus(v.fees).toFixed(4),
    }));
  }

  function handleExportExcel() {
    const params = new URLSearchParams({
      format: "xlsx",
      ...(selectedBuId ? { businessUnitId: selectedBuId } : {}),
      ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
      ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
      ...(filters.currencyId ? { currencyId: filters.currencyId } : {}),
    });
    window.open(`/api/cashflow-report?${params}`, "_blank");
  }

  const curOptions = currencies.map((c) => ({ value: c.id, label: `${c.symbol} ${c.code}` }));

  const filterConfigs: FilterConfig[] = [
    { key: "dateFrom", label: "Từ ngày", type: "date" },
    { key: "dateTo", label: "Đến ngày", type: "date" },
    { key: "currencyId", label: "Tiền tệ", type: "select", options: curOptions },
  ];

  // Negate raw amount for money-out rows so the table column shows signed cashflow.
  function signedByDirection(amount: string | null | undefined, isMoneyIn: boolean): string {
    const a = amount ?? "0";
    return isMoneyIn ? a : new Decimal(a).negated().toString();
  }

  // Thực thu/chi: Thu = nguyên tệ − phí NH, Chi = nguyên tệ + phí NH; signed by direction.
  function computeNetAmount(row: CashflowTransaction): string {
    const amt = new Decimal(row.amountOriginal ?? "0");
    const fee = new Decimal(row.bankFeeOriginal ?? "0");
    const net = row.isMoneyIn ? amt.minus(fee) : amt.plus(fee);
    return (row.isMoneyIn ? net : net.negated()).toDecimalPlaces(4).toString();
  }

  function rowTooltip(row: CashflowTransaction): string {
    return [
      `Tham chiếu: ${row.bankReference || "—"}`,
      `Ghi chú: ${row.notes || "—"}`,
      `Người tạo: ${row.createdBy}`,
    ].join("\n");
  }

  const columns: Column<CashflowTransaction>[] = [
    {
      key: "index",
      label: "STT",
      render: (_: unknown, __: CashflowTransaction, idx?: number) => (idx ?? 0) + 1,
    },
    {
      key: "transactionDate",
      label: "Ngày",
      sortable: true,
      render: (v) => new Date(v as string).toLocaleDateString("vi-VN"),
    },
    {
      key: "businessUnit",
      label: "Đơn vị",
      render: (_, row) => row.businessUnit?.code ?? "—",
    },
    {
      key: "category",
      label: "Loại",
      render: (v, row) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          row.isMoneyIn ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}>
          {v as string}
        </span>
      ),
    },
    {
      key: "partyName",
      label: "Đối tác",
      render: (v) => (v as string | null) ?? "—",
    },
    {
      key: "description",
      label: "Diễn giải",
      render: (v) => (v as string | null) ?? "—",
    },
    {
      key: "orderNumber",
      label: "Mã đơn",
      render: (v) => (v as string | null) ?? "—",
    },
    {
      key: "amountOriginal",
      label: "Nguyên tệ",
      align: "right",
      render: (v, row) => (
        <span title={rowTooltip(row)}>
          <CurrencyAmount
            amount={signedByDirection(v as string, row.isMoneyIn)}
            currencyCode={row.currency?.code ?? "VND"}
            currencySymbol={row.currency?.symbol ?? "₫"}
          />
        </span>
      ),
    },
    {
      key: "bankFeeOriginal",
      label: "Phí NH",
      align: "right",
      render: (v, row) =>
        v && parseFloat(v as string) > 0 ? (
          <CurrencyAmount
            amount={v as string}
            currencyCode={row.currency?.code ?? "VND"}
            currencySymbol={row.currency?.symbol ?? "₫"}
          />
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "netAmount",
      label: "Thực thu/chi",
      align: "right",
      render: (_: unknown, row: CashflowTransaction) => (
        <CurrencyAmount
          amount={computeNetAmount(row)}
          currencyCode={row.currency?.code ?? "VND"}
          currencySymbol={row.currency?.symbol ?? "₫"}
        />
      ),
    },
    {
      key: "amountVnd",
      label: "Quy đổi VND",
      align: "right",
      render: (v, row) =>
        row.currency?.code !== "VND" && parseFloat((v as string) || "0") > 0 ? (
          <CurrencyAmount
            amount={signedByDirection(v as string, row.isMoneyIn)}
            currencyCode="VND"
            currencySymbol="₫"
          />
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "orderId",
      label: "",
      align: "center",
      render: (v) => <OrderLinkCell orderId={v as string | null} />,
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

      <FilterBar
        filters={filterConfigs}
        onFilterChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
        values={filters}
      />
      <DateQuickPresets onSelect={(from, to) => {
        setFilters((prev) => ({ ...prev, dateFrom: from, dateTo: to }));
      }} />

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

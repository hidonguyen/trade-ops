// Deposit tracking report — timeline of deposit creation, usage, and refund events
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { DataTable, Column } from "@/components/shared/data-table";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { DateQuickPresets, getThisWeekRange } from "@/components/shared/date-quick-presets";
import { CurrencyAmount } from "@/components/shared/currency-amount";

interface DepositEvent {
  id: string;
  date: string;
  eventType: "DEPOSIT_CREATED" | "DEPOSIT_USED" | "DEPOSIT_REFUNDED";
  amountOriginal: string;
  depositId: string;
  remainingOriginal: string;
  party: { id: string; name: string };
  currency: { code: string; symbol: string };
  businessUnit: { code: string };
  reference: string | null;
}

interface Party { id: string; name: string; }
interface Currency { id: string; code: string; symbol: string; }

const EVENT_LABELS: Record<string, { label: string; className: string }> = {
  DEPOSIT_CREATED: { label: "Đặt cọc", className: "bg-blue-100 text-blue-700" },
  DEPOSIT_USED: { label: "Trừ cọc", className: "bg-red-100 text-red-700" },
  DEPOSIT_REFUNDED: { label: "Hoàn cọc", className: "bg-green-100 text-green-700" },
};

export default function DepositReportPage() {
  const { selectedBuId } = useSelectedBu();
  const [events, setEvents] = useState<DepositEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>(getThisWeekRange);
  const [parties, setParties] = useState<Party[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  // Load reference data
  useEffect(() => {
    const buParam = selectedBuId ? `?businessUnitId=${selectedBuId}&limit=200` : "?limit=200";
    Promise.all([
      fetch(`/api/parties${buParam}`).then((r) => r.json()),
      fetch("/api/currencies").then((r) => r.json()),
    ]).then(([pJson, cJson]) => {
      if (pJson.success) setParties(pJson.data);
      if (cJson.success) setCurrencies(cJson.data);
    }).catch(console.error);
  }, [selectedBuId]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(selectedBuId ? { businessUnitId: selectedBuId } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        ...(filters.partyId ? { partyId: filters.partyId } : {}),
        ...(filters.currencyId ? { currencyId: filters.currencyId } : {}),
      });
      const res = await fetch(`/api/reports/deposits?${params}`);
      const json = await res.json();
      if (json.success) setEvents(json.data);
    } catch (err) {
      console.error("Lỗi tải báo cáo cọc:", err);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedBuId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const filterConfigs: FilterConfig[] = [
    { key: "dateFrom", label: "Từ ngày", type: "date" },
    { key: "dateTo", label: "Đến ngày", type: "date" },
    {
      key: "partyId",
      label: "Đối tác",
      type: "select",
      options: parties.map((p) => ({ value: p.id, label: p.name })),
    },
    {
      key: "currencyId",
      label: "Tiền tệ",
      type: "select",
      options: currencies.map((c) => ({ value: c.id, label: `${c.symbol} ${c.code}` })),
    },
  ];

  const columns: Column<DepositEvent>[] = [
    {
      key: "date",
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
      key: "eventType",
      label: "Loại",
      render: (v) => {
        const info = EVENT_LABELS[v] ?? { label: v, className: "bg-slate-100 text-slate-700" };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${info.className}`}>
            {info.label}
          </span>
        );
      },
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
      key: "remainingOriginal",
      label: "Số dư",
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
      key: "currency",
      label: "Tiền tệ",
      render: (_, row) => row.currency?.code ?? "—",
    },
    {
      key: "businessUnit",
      label: "Đơn vị",
      render: (_, row) => row.businessUnit?.code ?? "—",
    },
    {
      key: "reference",
      label: "Ghi chú",
      render: (v) => v ?? "—",
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Theo dõi cọc</h1>

      <FilterBar filters={filterConfigs} onFilterChange={handleFilterChange} values={filters} />
      <DateQuickPresets onSelect={(from, to) => {
        setFilters((prev) => ({ ...prev, dateFrom: from, dateTo: to }));
      }} />

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={events as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Không có dữ liệu cọc trong kỳ này"
      />
    </div>
  );
}

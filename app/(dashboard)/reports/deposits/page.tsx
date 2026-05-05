// Deposit tracking report — master-detail: each deposit row expands to show
// its usage events (deductions/refunds). REFUND-source seed usage is hidden.
"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { DateQuickPresets } from "@/components/shared/date-quick-presets";
import { getInitialDateRange, usePersistDateRange, useRestorePersistedDateRange } from "@/components/shared/use-persisted-date-range";
import { CurrencyAmount } from "@/components/shared/currency-amount";
import { DownloadIcon } from "lucide-react";
import { OrderLinkCell } from "@/components/reports/order-link-cell";

interface DepositUsage {
  id: string;
  createdAt: string;
  amountOriginal: string;
  eventType: "DEPOSIT_USED" | "DEPOSIT_REFUNDED";
  reference: string | null;
  orderId: string | null;
}

interface DepositMaster {
  id: string;
  createdAt: string;
  source: string;
  partyId: string;
  partyName: string;
  partyType: string;
  buCode: string;
  currencyCode: string;
  currencySymbol: string;
  amountOriginal: string;
  remainingOriginal: string;
  notes: string | null;
  usages: DepositUsage[];
}

interface Party { id: string; name: string; }
interface Currency { id: string; code: string; symbol: string; }

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

export default function DepositReportPage() {
  const { selectedBuId, isLoaded: buLoaded } = useSelectedBu();
  const [deposits, setDeposits] = useState<DepositMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>(() => ({
    ...getInitialDateRange("deposits"),
    hideDepleted: "true",
  }));
  const dateRestored = useRestorePersistedDateRange("deposits", (range) => {
    setFilters((prev) => ({ ...prev, ...range }));
  });
  usePersistDateRange("deposits", filters.dateFrom, filters.dateTo);
  const [parties, setParties] = useState<Party[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  useEffect(() => {
    if (!buLoaded || !selectedBuId) return;
    Promise.all([
      fetch(`/api/parties?businessUnitId=${selectedBuId}&limit=200`).then((r) => r.json()),
      fetch("/api/currencies").then((r) => r.json()),
    ]).then(([pJson, cJson]) => {
      if (pJson.success) setParties(pJson.data);
      if (cJson.success) setCurrencies(cJson.data);
    }).catch(console.error);
  }, [selectedBuId, buLoaded]);

  const fetchReport = useCallback(async (signal?: AbortSignal) => {
    if (!buLoaded || !selectedBuId || !dateRestored) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        businessUnitId: selectedBuId,
        hideDepleted: filters.hideDepleted ?? "true",
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        ...(filters.partyId ? { partyId: filters.partyId } : {}),
        ...(filters.currencyId ? { currencyId: filters.currencyId } : {}),
      });
      const res = await fetch(`/api/reports/deposits?${params}`, { signal });
      if (signal?.aborted) return;
      const json = await res.json();
      if (json.success) setDeposits(json.data?.deposits ?? []);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Lỗi tải báo cáo cọc:", err);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filters, selectedBuId, buLoaded, dateRestored]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchReport(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchReport]);

  function handleExportExcel() {
    if (!selectedBuId) return;
    const params = new URLSearchParams({
      businessUnitId: selectedBuId,
      hideDepleted: filters.hideDepleted ?? "true",
      format: "xlsx",
      ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
      ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
      ...(filters.partyId ? { partyId: filters.partyId } : {}),
      ...(filters.currencyId ? { currencyId: filters.currencyId } : {}),
    });
    window.open(`/api/reports/deposits?${params}`, "_blank");
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

  const hideDepleted = filters.hideDepleted !== "false";

  const COLS = 8;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Theo dõi cọc</h1>
        <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!selectedBuId}>
          <DownloadIcon className="size-4 mr-1.5" /> Xuất Excel
        </Button>
      </div>

      <FilterBar
        filters={filterConfigs}
        onFilterChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
        values={filters}
      />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateQuickPresets onSelect={(from, to) => {
          setFilters((prev) => ({ ...prev, dateFrom: from, dateTo: to }));
        }} />
        <label className="flex items-center gap-2 text-sm text-slate-600 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={hideDepleted}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, hideDepleted: String(e.target.checked) }))
            }
            className="size-4 rounded border-slate-300"
          />
          Ẩn cọc đã hết số dư
        </label>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Đối tác</th>
              <th className="px-3 py-2">Nguồn</th>
              <th className="px-3 py-2 text-right">Đặt cọc</th>
              <th className="px-3 py-2 text-right">Số dư</th>
              <th className="px-3 py-2">Tiền tệ</th>
              <th className="px-3 py-2">Đơn vị</th>
              <th className="px-3 py-2">Ghi chú</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={COLS} className="px-3 py-6 text-center text-slate-400">Đang tải...</td></tr>
            )}
            {!loading && deposits.length === 0 && (
              <tr><td colSpan={COLS} className="px-3 py-6 text-center text-slate-400">Không có cọc nào trong kỳ này</td></tr>
            )}
            {!loading && deposits.map((d) => {
              return (
                <Fragment key={d.id}>
                  <tr className="border-t bg-white font-medium">
                    <td className="px-3 py-2">{formatDateTime(d.createdAt)}</td>
                    <td className="px-3 py-2">{d.partyName}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        d.source === "REFUND"
                          ? "bg-orange-100 text-orange-700"
                          : d.partyType === "SUPPLIER"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                      }`}>
                        {d.source === "REFUND"
                          ? d.partyType === "SUPPLIER" ? "Hoàn từ đơn mua" : "Hoàn từ đơn bán"
                          : d.partyType === "SUPPLIER" ? "Cọc NCC" : "Cọc KH"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <CurrencyAmount amount={d.amountOriginal} currencyCode={d.currencyCode} currencySymbol={d.currencySymbol} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <CurrencyAmount amount={d.remainingOriginal} currencyCode={d.currencyCode} currencySymbol={d.currencySymbol} />
                    </td>
                    <td className="px-3 py-2">{d.currencyCode}</td>
                    <td className="px-3 py-2">{d.buCode}</td>
                    <td className="px-3 py-2">{d.notes ?? "—"}</td>
                    <td className="px-3 py-2"></td>
                  </tr>
                  {d.usages.map((u) => {
                    const signedAmt = u.eventType === "DEPOSIT_USED"
                      ? "-" + u.amountOriginal
                      : u.amountOriginal;
                    return (
                    <tr key={u.id} className="border-t border-slate-100 bg-slate-50/60 text-slate-600">
                      <td className="px-3 py-1.5 pl-6">↳ {formatDateTime(u.createdAt)}</td>
                      <td className="px-3 py-1.5"></td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.eventType === "DEPOSIT_USED" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                        }`}>
                          {u.eventType === "DEPOSIT_USED" ? "Trừ cọc" : "Hoàn cọc"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <CurrencyAmount amount={signedAmt} currencyCode={d.currencyCode} currencySymbol={d.currencySymbol} />
                      </td>
                      <td className="px-3 py-1.5"></td>
                      <td className="px-3 py-1.5">{d.currencyCode}</td>
                      <td className="px-3 py-1.5"></td>
                      <td className="px-3 py-1.5">{u.reference ?? "—"}</td>
                      <td className="px-3 py-1.5 text-center">
                        <OrderLinkCell orderId={u.orderId} />
                      </td>
                    </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Dashboard home — KPI cards + charts, fetches /api/reports/dashboard
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { TrendingUpIcon, TrendingDownIcon, PiggyBankIcon, ActivityIcon, LandmarkIcon } from "lucide-react";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { KpiCard } from "@/components/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BarDataPoint, PieDataPoint } from "@/components/dashboard-charts";

const DashboardCharts = dynamic(() => import("@/components/dashboard-charts"), { ssr: false });

interface CurrencyAmount { code: string; symbol: string; total: string; }

interface DashboardData {
  totalReceivable: CurrencyAmount[];
  totalPayable: CurrencyAmount[];
  recentTransactionCount: number;
  depositBalances: CurrencyAmount[];
  totalBankFeeVnd: string;
}

// Format multiple currency entries as compact string
function formatCurrencyList(items: CurrencyAmount[]): string {
  if (!items || items.length === 0) return "0";
  return items
    .map((c) => `${c.symbol}${parseFloat(c.total).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}`)
    .join(" | ");
}

// Build donut pie data from currency amounts
function buildPieData(items: CurrencyAmount[]): PieDataPoint[] {
  const COLORS = ["#1E3A8A", "#0284C7", "#7C3AED", "#059669", "#DC2626"];
  return items.map((c, i) => ({
    name: c.code,
    value: Math.abs(parseFloat(c.total)),
    fill: COLORS[i % COLORS.length],
  }));
}

// Placeholder bar data — months year-to-date with zeroes until real tx data is available
function buildPlaceholderBarData(): BarDataPoint[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      month: d.toLocaleDateString("vi-VN", { month: "short", year: "2-digit" }),
      receipts: 0,
      payments: 0,
    };
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const { selectedBuId } = useSelectedBu();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!selectedBuId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/dashboard?businessUnitId=${selectedBuId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
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
    fetchDashboard();
  }, [fetchDashboard]);

  const pieData = data
    ? buildPieData([...data.totalReceivable, ...data.depositBalances])
    : [];
  const barData = buildPlaceholderBarData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1>
        <p className="mt-0.5 text-sm text-slate-500">Dữ liệu tài chính theo đơn vị kinh doanh</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px] w-full rounded-xl" />
          ))
        ) : (
          <>
            <KpiCard
              title="Phải thu"
              value={data ? formatCurrencyList(data.totalReceivable) : "—"}
              subtitle="Tổng công nợ khách hàng"
              accentColor="#1E3A8A"
              icon={<TrendingUpIcon className="size-5" />}
            />
            <KpiCard
              title="Phải trả"
              value={data ? formatCurrencyList(data.totalPayable) : "—"}
              subtitle="Tổng công nợ nhà cung cấp"
              accentColor="#F59E0B"
              icon={<TrendingDownIcon className="size-5" />}
            />
            <KpiCard
              title="Số dư đặt cọc"
              value={data ? formatCurrencyList(data.depositBalances) : "—"}
              subtitle="Đặt cọc còn lại"
              accentColor="#059669"
              icon={<PiggyBankIcon className="size-5" />}
            />
            <KpiCard
              title="Giao dịch (30 ngày)"
              value={data ? String(data.recentTransactionCount) : "—"}
              subtitle="Số giao dịch gần đây"
              accentColor="#7C3AED"
              icon={<ActivityIcon className="size-5" />}
            />
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(today.getDate() - 30);
                const params = new URLSearchParams({
                  dateFrom: thirtyDaysAgo.toISOString().slice(0, 10),
                  dateTo: today.toISOString().slice(0, 10),
                });
                router.push(`/reports/bank-fees?${params}`);
              }}
              className="text-left"
            >
              <KpiCard
                title="Phí NH (30 ngày)"
                value={
                  data
                    ? `₫${parseFloat(data.totalBankFeeVnd ?? "0").toLocaleString("vi-VN", { maximumFractionDigits: 0 })}`
                    : "—"
                }
                subtitle="Công ty chịu, xem chi tiết"
                accentColor="#D97706"
                icon={<LandmarkIcon className="size-5" />}
              />
            </button>
          </>
        )}
      </div>

      {/* Charts */}
      {!loading && (
        <DashboardCharts barData={barData} pieData={pieData} />
      )}
    </div>
  );
}

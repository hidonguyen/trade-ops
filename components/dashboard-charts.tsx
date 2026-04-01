// Recharts dashboard charts: monthly bar chart + currency donut pie chart
// Must be "use client" — dynamically imported (no SSR) from dashboard page
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface BarDataPoint {
  month: string;
  receipts: number;
  payments: number;
}

export interface PieDataPoint {
  name: string;
  value: number;
  fill: string;
}

interface DashboardChartsProps {
  barData: BarDataPoint[];
  pieData: PieDataPoint[];
}

const BAR_RECEIPTS = "#1E3A8A";
const BAR_PAYMENTS = "#F59E0B";

export default function DashboardCharts({ barData, pieData }: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Monthly receipts vs payments bar chart */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">
            Thu / Chi theo tháng
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} width={56} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}
                formatter={(val) => (typeof val === "number" ? val.toLocaleString("vi-VN") : String(val))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receipts" name="Tổng thu" fill={BAR_RECEIPTS} radius={[3, 3, 0, 0]} />
              <Bar dataKey="payments" name="Tổng chi" fill={BAR_PAYMENTS} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Currency distribution donut pie chart */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">
            Phân bổ theo tiền tệ
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          {pieData.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
              Không có dữ liệu
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}
                  formatter={(val) => (typeof val === "number" ? val.toLocaleString("vi-VN") : String(val))}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

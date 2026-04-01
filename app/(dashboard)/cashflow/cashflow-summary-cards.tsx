// Cashflow summary cards — total receipts, payments, net per currency
import { Card, CardContent } from "@/components/ui/card";
import { CurrencyAmount } from "@/components/shared/currency-amount";

interface CurrencySummary {
  currencyCode: string;
  currencySymbol: string;
  totalReceipts: string;
  totalPayments: string;
  netCashflow: string;
}

interface CashflowSummaryCardsProps {
  summaries: CurrencySummary[];
}

interface MetricCardProps {
  label: string;
  value: string;
  currencyCode: string;
  currencySymbol: string;
  colorClass: string;
}

function MetricCard({ label, value, currencyCode, currencySymbol, colorClass }: MetricCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">{label}</p>
      <CurrencyAmount
        amount={value}
        currencyCode={currencyCode}
        currencySymbol={currencySymbol}
        className="text-lg font-semibold"
      />
    </div>
  );
}

export function CashflowSummaryCards({ summaries }: CashflowSummaryCardsProps) {
  if (summaries.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-4">
        Chưa có dữ liệu dòng tiền cho kỳ này
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summaries.map((s) => (
        <Card key={s.currencyCode}>
          <CardContent className="pt-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">
              {s.currencySymbol} {s.currencyCode}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MetricCard
                label="Tổng thu"
                value={s.totalReceipts}
                currencyCode={s.currencyCode}
                currencySymbol={s.currencySymbol}
                colorClass="bg-green-50 border-green-200"
              />
              <MetricCard
                label="Tổng chi"
                value={s.totalPayments}
                currencyCode={s.currencyCode}
                currencySymbol={s.currencySymbol}
                colorClass="bg-red-50 border-red-200"
              />
              <MetricCard
                label="Lưu chuyển ròng"
                value={s.netCashflow}
                currencyCode={s.currencyCode}
                currencySymbol={s.currencySymbol}
                colorClass={
                  parseFloat(s.netCashflow) >= 0
                    ? "bg-blue-50 border-blue-200"
                    : "bg-orange-50 border-orange-200"
                }
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

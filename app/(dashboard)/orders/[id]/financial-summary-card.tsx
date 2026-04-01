// Financial summary card — shows paid/refunded/remaining amounts from report endpoint
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyAmount } from "@/components/shared/currency-amount";

interface FinancialSummary {
  orderAmountOriginal: string;
  totalPaidOriginal: string;
  totalRefundedOriginal: string;
  netPaidOriginal: string;
  balanceOriginal: string;
  bankPaymentsOriginal: string;
  depositPaymentsOriginal: string;
  transactionCount: number;
}

interface FinancialSummaryCardProps {
  summary: FinancialSummary;
  currencyCode: string;
  currencySymbol: string;
}

interface SummaryRowProps {
  label: string;
  value: string;
  currencyCode: string;
  currencySymbol: string;
  highlight?: "positive" | "negative" | "neutral";
}

function SummaryRow({ label, value, currencyCode, currencySymbol, highlight }: SummaryRowProps) {
  const highlightClass =
    highlight === "positive"
      ? "text-green-700 font-semibold"
      : highlight === "negative"
      ? "text-red-600 font-semibold"
      : "";

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={highlightClass}>
        <CurrencyAmount amount={value} currencyCode={currencyCode} currencySymbol={currencySymbol} />
      </span>
    </div>
  );
}

export function FinancialSummaryCard({ summary, currencyCode, currencySymbol }: FinancialSummaryCardProps) {
  const remaining = parseFloat(summary.balanceOriginal);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tổng kết thanh toán</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          <SummaryRow
            label="Giá trị đơn hàng"
            value={summary.orderAmountOriginal}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
          />
          <SummaryRow
            label="Đã thanh toán"
            value={summary.totalPaidOriginal}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
            highlight="positive"
          />
          <SummaryRow
            label="Đã hoàn tiền"
            value={summary.totalRefundedOriginal}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
            highlight={parseFloat(summary.totalRefundedOriginal) > 0 ? "negative" : "neutral"}
          />
          <SummaryRow
            label="Thanh toán qua ngân hàng"
            value={summary.bankPaymentsOriginal}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
          />
          <SummaryRow
            label="Thanh toán qua cọc"
            value={summary.depositPaymentsOriginal}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
          />
          <SummaryRow
            label="Còn phải thanh toán"
            value={summary.balanceOriginal}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
            highlight={remaining > 0 ? "negative" : remaining < 0 ? "positive" : "neutral"}
          />
        </div>
        <p className="mt-3 text-xs text-slate-400">{summary.transactionCount} giao dịch</p>
      </CardContent>
    </Card>
  );
}

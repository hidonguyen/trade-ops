// Financial summary card — shows paid/refunded/remaining amounts from report endpoint
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyAmount } from "@/components/shared/currency-amount";

interface FinancialSummary {
  orderAmountOriginal: string;
  // New fields from phase 03 — adjustment total + effective value
  adjustmentTotalOriginal?: string;
  effectiveValueOriginal?: string;
  totalPaidOriginal: string;
  totalRefundedOriginal: string;
  netPaidOriginal: string;
  balanceOriginal: string;
  bankPaymentsOriginal: string;
  depositPaymentsOriginal: string;
  // Refund breakdown by method — symmetric to payment breakdown
  bankRefundsOriginal?: string;
  depositRefundsOriginal?: string;
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

function SummaryRow({ label, value, currencyCode, currencySymbol, highlight, indented }: SummaryRowProps & { indented?: boolean }) {
  const highlightClass =
    highlight === "positive"
      ? "text-green-700 font-semibold"
      : highlight === "negative"
      ? "text-red-600 font-semibold"
      : "";

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className={`text-sm ${indented ? "pl-6 text-slate-500 before:content-['·_'] before:text-slate-400" : "text-slate-600"}`}>{label}</span>
      <span className={highlightClass}>
        <CurrencyAmount amount={value} currencyCode={currencyCode} currencySymbol={currencySymbol} />
      </span>
    </div>
  );
}

export function FinancialSummaryCard({ summary, currencyCode, currencySymbol }: FinancialSummaryCardProps) {
  const adjustmentTotal = parseFloat(summary.adjustmentTotalOriginal ?? "0");
  const totalRefunded = parseFloat(summary.totalRefundedOriginal);
  const remaining = parseFloat(summary.balanceOriginal);

  const adjustmentHighlight: "positive" | "negative" | "neutral" =
    adjustmentTotal < 0 ? "negative" : adjustmentTotal > 0 ? "positive" : "neutral";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tổng kết thanh toán</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {/* Order value: gross original; adjustment shown as a separate breakdown row */}
          <SummaryRow
            label="Giá trị đơn hàng"
            value={summary.orderAmountOriginal}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
          />
          {adjustmentTotal !== 0 && (
            <SummaryRow
              label="Điều chỉnh"
              value={summary.adjustmentTotalOriginal ?? "0"}
              currencyCode={currencyCode}
              currencySymbol={currencySymbol}
              highlight={adjustmentHighlight}
              indented
            />
          )}

          {/* Payment side: gross total + breakdown by method */}
          <SummaryRow
            label="Đã thanh toán"
            value={summary.totalPaidOriginal}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
            highlight="positive"
          />
          <SummaryRow
            label="Qua ngân hàng"
            value={summary.bankPaymentsOriginal}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
            indented
          />
          <SummaryRow
            label="Qua cọc"
            value={summary.depositPaymentsOriginal}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
            indented
          />

          {/* Refund side: gross total + breakdown by method (only when any refund exists) */}
          {totalRefunded > 0 && (
            <>
              <SummaryRow
                label="Đã hoàn tiền"
                value={summary.totalRefundedOriginal}
                currencyCode={currencyCode}
                currencySymbol={currencySymbol}
                highlight="negative"
              />
              <SummaryRow
                label="Qua ngân hàng"
                value={summary.bankRefundsOriginal ?? "0"}
                currencyCode={currencyCode}
                currencySymbol={currencySymbol}
                indented
              />
              <SummaryRow
                label="Qua cọc"
                value={summary.depositRefundsOriginal ?? "0"}
                currencyCode={currencyCode}
                currencySymbol={currencySymbol}
                indented
              />
            </>
          )}

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

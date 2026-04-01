// Currency amount display with locale-aware formatting and mono font
import { cn } from "@/lib/utils";

interface CurrencyAmountProps {
  amount: string | number;
  currencySymbol: string;
  currencyCode: string;
  className?: string;
}

function formatAmount(amount: number, currencyCode: string): string {
  if (currencyCode === "VND") {
    // VND: dot as thousand separator, no decimals
    return amount.toLocaleString("vi-VN").replace(/\./g, ".") + " ₫";
  }
  // USD, RMB: comma as thousand separator, 2 decimals
  const symbol = currencyCode === "USD" ? "$" : "¥";
  return symbol + Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CurrencyAmount({ amount, currencyCode, className }: CurrencyAmountProps) {
  const numeric = typeof amount === "string" ? parseFloat(amount) : amount;
  const isNegative = numeric < 0;

  let formatted: string;
  if (currencyCode === "VND") {
    formatted = Math.abs(numeric).toLocaleString("vi-VN") + " ₫";
  } else if (currencyCode === "USD") {
    formatted = "$" + Math.abs(numeric).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    // RMB / CNY
    formatted = "¥" + Math.abs(numeric).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <span
      className={cn(
        "font-mono tabular-nums text-right",
        isNegative ? "text-red-600" : "",
        className
      )}
    >
      {isNegative ? "-" : ""}{formatted}
    </span>
  );
}

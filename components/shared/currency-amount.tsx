// Currency amount display with locale-aware formatting and mono font
import { cn } from "@/lib/utils";

interface CurrencyAmountProps {
  amount: string | number;
  currencySymbol: string;
  currencyCode: string;
  className?: string;
}

export function CurrencyAmount({ amount, currencyCode, currencySymbol, className }: CurrencyAmountProps) {
  const numeric = typeof amount === "string" ? parseFloat(amount) : amount;
  const isNegative = numeric < 0;

  // VND uses Vietnamese locale (. as thousand sep) with suffix ₫; other
  // currencies use en-US with the supplied symbol prefix and 2 decimals.
  let formatted: string;
  if (currencyCode === "VND") {
    formatted = Math.abs(numeric).toLocaleString("vi-VN") + " " + (currencySymbol || "₫");
  } else {
    const symbol = currencySymbol || currencyCode;
    formatted =
      symbol +
      Math.abs(numeric).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

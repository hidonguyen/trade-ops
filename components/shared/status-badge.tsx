// Order status badge with Vietnamese labels and semantic colors
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; style: string }> = {
  UNPAID: {
    label: "Chưa TT",
    style: "bg-slate-100 text-slate-600",
  },
  PARTIAL_PAID: {
    label: "TT 1 phần",
    style: "bg-yellow-100 text-yellow-800",
  },
  PAID: {
    label: "Đã TT",
    style: "bg-green-100 text-green-800",
  },
  PARTIAL_REFUNDED: {
    label: "Hoàn 1 phần",
    style: "bg-orange-100 text-orange-800",
  },
  REFUNDED: {
    label: "Đã hoàn",
    style: "bg-red-100 text-red-800",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    style: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.style,
        className
      )}
    >
      {config.label}
    </span>
  );
}

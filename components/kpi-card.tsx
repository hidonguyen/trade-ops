// KPI metric card with accent top border and mono value display
import { Card, CardContent } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  accentColor?: string;
  icon?: React.ReactNode;
}

export function KpiCard({ title, value, subtitle, accentColor = "#1E3A8A", icon }: KpiCardProps) {
  return (
    <Card className="overflow-hidden border-slate-200">
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 leading-tight">
              {value}
            </p>
            {subtitle && (
              <p className="mt-1 text-xs text-slate-400 truncate">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className="shrink-0 flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

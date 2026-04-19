// Quick date-range preset buttons — reusable across all pages with date filters
// Each preset sets both dateFrom + dateTo as YYYY-MM-DD strings
"use client";

import { Button } from "@/components/ui/button";

interface DateQuickPresetsProps {
  onSelect: (dateFrom: string, dateTo: string) => void;
}

// Format Date → YYYY-MM-DD using local timezone (not UTC)
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPresets(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  // Week: Monday-based (ISO)
  const dayOfWeek = today.getDay() || 7; // Sunday = 7
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek + 1);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setDate(weekStart.getDate() - 1);

  // Month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  // Year
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const prevYearStart = new Date(today.getFullYear() - 1, 0, 1);
  const prevYearEnd = new Date(today.getFullYear() - 1, 11, 31);

  return [
    { label: "Hôm nay", from: fmt(today), to: fmt(today) },
    { label: "Hôm qua", from: fmt(yesterday), to: fmt(yesterday) },
    { label: "Tuần này", from: fmt(weekStart), to: fmt(today) },
    { label: "Tuần trước", from: fmt(prevWeekStart), to: fmt(prevWeekEnd) },
    { label: "Tháng này", from: fmt(monthStart), to: fmt(today) },
    { label: "Tháng trước", from: fmt(prevMonthStart), to: fmt(prevMonthEnd) },
    { label: "Năm nay", from: fmt(yearStart), to: fmt(today) },
    { label: "Năm trước", from: fmt(prevYearStart), to: fmt(prevYearEnd) },
  ];
}

// Get "this week" date range (Mon-today) — use as default filters
export function getThisWeekRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay() || 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek + 1);
  return { dateFrom: fmt(weekStart), dateTo: fmt(today) };
}

export function DateQuickPresets({ onSelect }: DateQuickPresetsProps) {
  const presets = getPresets();

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-slate-500 mr-0.5">Nhanh:</span>
      {presets.map((p) => (
        <Button
          key={p.label}
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onSelect(p.from, p.to)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}

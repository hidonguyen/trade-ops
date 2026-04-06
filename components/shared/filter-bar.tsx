// Filter controls: selects, search input, date range in a flex row
"use client";

import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchIcon } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "search" | "date" | "date-range";
  options?: FilterOption[];
  placeholder?: string;
}

interface FilterBarProps {
  filters: FilterConfig[];
  onFilterChange: (key: string, value: string) => void;
  values?: Record<string, string>;
}

export function FilterBar({ filters, onFilterChange, values = {} }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {filters.map((filter) => {
        if (filter.type === "search") {
          return (
            <div key={filter.key} className="relative min-w-[200px]">
              <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                placeholder={filter.placeholder ?? filter.label}
                value={values[filter.key] ?? ""}
                onChange={(e) => onFilterChange(filter.key, e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          );
        }

        if (filter.type === "date") {
          return (
            <div key={filter.key}>
              <DatePicker
                value={values[filter.key] ?? ""}
                onChange={(v) => onFilterChange(filter.key, v)}
                placeholder={filter.label}
              />
            </div>
          );
        }

        if (filter.type === "date-range") {
          return (
            <div key={filter.key} className="flex items-center gap-1.5">
              <DatePicker
                value={values[`${filter.key}From`] ?? ""}
                onChange={(v) => onFilterChange(`${filter.key}From`, v)}
                placeholder="Từ ngày"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <DatePicker
                value={values[`${filter.key}To`] ?? ""}
                onChange={(v) => onFilterChange(`${filter.key}To`, v)}
                placeholder="Đến ngày"
              />
            </div>
          );
        }

        // select → combobox with "Tất cả" option
        return (
          <Combobox
            key={filter.key}
            value={values[filter.key] ?? ""}
            onValueChange={(val) => onFilterChange(filter.key, val)}
            options={[
              { value: "", label: "Tất cả" },
              ...(filter.options ?? []),
            ]}
            placeholder={filter.label}
            className="min-w-[140px]"
          />
        );
      })}
    </div>
  );
}

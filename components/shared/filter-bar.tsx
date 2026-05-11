// Filter controls: multi-select comboboxes, search input (debounced), date range — each with a visible label.
// All `type: "select"` filters render as MultiCombobox; values are stored as CSV strings.
"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { MultiCombobox } from "@/components/ui/multi-combobox";
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

// Small wrapper that adds a label above each control.
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </div>
  );
}

// Search input that debounces keystrokes before notifying parent (avoids API spam).
function DebouncedSearchInput({
  value,
  placeholder,
  delay = 400,
  onChange,
}: {
  value: string;
  placeholder: string;
  delay?: number;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);

  // Sync external resets (e.g. filter cleared elsewhere) into local state.
  useEffect(() => { setLocal(value); }, [value]);

  // Commit local → parent after user stops typing for `delay` ms.
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), delay);
    return () => clearTimeout(t);
  }, [local, value, delay, onChange]);

  return (
    <div className="relative min-w-[200px]">
      <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <Input
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="pl-8 h-8"
      />
    </div>
  );
}

export function FilterBar({ filters, onFilterChange, values = {} }: FilterBarProps) {
  return (
    <div className="flex items-end gap-3 overflow-x-auto flex-wrap">
      {filters.map((filter) => {
        if (filter.type === "search") {
          return (
            <FilterField key={filter.key} label={filter.label}>
              <DebouncedSearchInput
                value={values[filter.key] ?? ""}
                placeholder={filter.placeholder ?? filter.label}
                onChange={(v) => onFilterChange(filter.key, v)}
              />
            </FilterField>
          );
        }

        if (filter.type === "date") {
          return (
            <FilterField key={filter.key} label={filter.label}>
              <DatePicker
                value={values[filter.key] ?? ""}
                onChange={(v) => onFilterChange(filter.key, v)}
                placeholder={filter.label}
              />
            </FilterField>
          );
        }

        if (filter.type === "date-range") {
          return (
            <FilterField key={filter.key} label={filter.label}>
              <div className="flex items-center gap-1.5">
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
            </FilterField>
          );
        }

        // select → multi-select combobox; values stored as CSV string
        const csvValue = values[filter.key] ?? "";
        const selectedArr = csvValue ? csvValue.split(",").map((s) => s.trim()).filter(Boolean) : [];
        return (
          <FilterField key={filter.key} label={filter.label}>
            <MultiCombobox
              values={selectedArr}
              onValuesChange={(arr) => onFilterChange(filter.key, arr.join(","))}
              options={filter.options ?? []}
              placeholder={filter.label}
              className="min-w-[140px]"
            />
          </FilterField>
        );
      })}
    </div>
  );
}

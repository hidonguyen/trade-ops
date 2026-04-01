// Filter controls: selects, search input, date range in a flex row
"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchIcon } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "search" | "date";
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
    <div className="flex flex-wrap items-center gap-2">
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
              <Input
                type="date"
                aria-label={filter.label}
                value={values[filter.key] ?? ""}
                onChange={(e) => onFilterChange(filter.key, e.target.value)}
                className="h-8 w-auto"
              />
            </div>
          );
        }

        // select
        return (
          <Select
            key={filter.key}
            value={values[filter.key] ?? ""}
            onValueChange={(val) => onFilterChange(filter.key, val ?? "")}
          >
            <SelectTrigger size="sm" className="min-w-[140px]">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tất cả</SelectItem>
              {(filter.options ?? []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
    </div>
  );
}

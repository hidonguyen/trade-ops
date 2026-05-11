// Multi-select combobox — allows selecting multiple options, renders chips in trigger.
// NOTE: filter values in this app are IDs (cuid/uuid) or uppercase enum constants —
//       neither contains commas, so CSV serialization needs no escaping.
// Built on Base UI Popover for positioning, native input for search.
"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, SearchIcon, XIcon, CheckIcon } from "lucide-react";

export interface MultiComboboxOption {
  value: string;
  label: string;
}

interface MultiComboboxProps {
  values: string[];
  onValuesChange: (next: string[]) => void;
  options: MultiComboboxOption[];
  placeholder?: string;
  className?: string;
}

// Strip diacritics for Vietnamese search (e.g. "nguyen" matches "Nguyễn")
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

export function MultiCombobox({
  values,
  onValuesChange,
  options,
  placeholder = "Chọn...",
  className,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();

  const filtered = React.useMemo(() => {
    if (!search) return options;
    const q = normalize(search);
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, search]);

  // Reset search when opening
  React.useEffect(() => {
    if (open) {
      setSearch("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  function toggle(val: string) {
    if (values.includes(val)) {
      onValuesChange(values.filter((v) => v !== val));
    } else {
      onValuesChange([...values, val]);
    }
  }

  function removeOne(val: string, e: React.MouseEvent) {
    e.stopPropagation();
    onValuesChange(values.filter((v) => v !== val));
  }

  function clearAll(e: React.MouseEvent) {
    e.stopPropagation();
    onValuesChange([]);
  }

  // Build label map for quick lookup
  const labelMap = React.useMemo(
    () => new Map(options.map((o) => [o.value, o.label])),
    [options]
  );

  // Render trigger: show first 2 chips + "+N more" badge, or placeholder
  function renderTriggerContent() {
    if (values.length === 0) {
      return <span className="text-muted-foreground truncate">{placeholder}</span>;
    }
    const MAX_CHIPS = 2;
    const shown = values.slice(0, MAX_CHIPS);
    const extra = values.length - MAX_CHIPS;
    return (
      <div className="flex items-center gap-1 flex-wrap overflow-hidden max-w-full">
        {shown.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700 shrink-0"
          >
            <span className="max-w-[80px] truncate">{labelMap.get(v) ?? v}</span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => removeOne(v, e)}
              className="ml-0.5 text-slate-400 hover:text-slate-700"
              aria-label={`Bỏ chọn ${labelMap.get(v) ?? v}`}
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        {extra > 0 && (
          <span className="inline-flex items-center rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600 shrink-0">
            +{extra}
          </span>
        )}
      </div>
    );
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-1 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 min-h-8 dark:bg-input/30 dark:hover:bg-input/50",
          className
        )}
      >
        <span className="flex-1 text-left overflow-hidden">{renderTriggerContent()}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          {values.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearAll}
              className="p-0.5 text-slate-400 hover:text-slate-700"
              aria-label="Xóa tất cả"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </div>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="bottom"
          sideOffset={4}
          align="start"
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            className="z-50 w-(--anchor-width) min-w-[180px] origin-(--transform-origin) rounded-lg bg-popover shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            {/* Search */}
            <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Options */}
            <div id={listboxId} role="listbox" aria-multiselectable="true" className="max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  Không tìm thấy
                </div>
              ) : (
                filtered.map((opt) => {
                  const selected = values.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => toggle(opt.value)}
                      className={cn(
                        "relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-sm outline-hidden select-none",
                        selected && "bg-accent/60 text-accent-foreground",
                        !selected && "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {/* Checkbox indicator */}
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        )}
                      >
                        {selected && <CheckIcon className="size-3" />}
                      </span>
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {values.length > 0 && (
              <div className="border-t border-border px-2.5 py-1.5">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onValuesChange([]); }}
                  className="text-xs text-slate-500 hover:text-red-600 transition-colors"
                >
                  Xóa tất cả ({values.length})
                </button>
              </div>
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

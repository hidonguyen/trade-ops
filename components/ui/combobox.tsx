// Searchable select dropdown — filters options by typed text, shows label after selection
// Built on Base UI Popover for positioning, native input for search
// Follows WAI-ARIA combobox pattern for accessibility
"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, CheckIcon, SearchIcon } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Strip diacritics for Vietnamese search (e.g., "nguyen" matches "Nguyễn")
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Chọn...",
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [focusIndex, setFocusIndex] = React.useState(0);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listboxId = React.useId();

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const filtered = React.useMemo(() => {
    if (!search) return options;
    const q = normalize(search);
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, search]);

  // Reset search and focus when opening
  React.useEffect(() => {
    if (open) {
      setSearch("");
      setFocusIndex(0);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  // Scroll focused item into view
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[focusIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [focusIndex, open]);

  function select(val: string) {
    onValueChange(val);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[focusIndex]) select(filtered[focusIndex].value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const activeDescendant = filtered[focusIndex]
    ? `${listboxId}-opt-${focusIndex}`
    : undefined;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 h-8 dark:bg-input/30 dark:hover:bg-input/50",
          !selectedLabel && "text-muted-foreground",
          className
        )}
      >
        <span className="flex-1 text-left truncate">
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
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
            {/* Search input */}
            <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                role="combobox"
                aria-expanded={open}
                aria-controls={listboxId}
                aria-activedescendant={activeDescendant}
                aria-autocomplete="list"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setFocusIndex(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Tìm kiếm..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Options list */}
            <div ref={listRef} id={listboxId} role="listbox" className="max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  Không tìm thấy
                </div>
              ) : (
                filtered.map((opt, i) => (
                  <button
                    key={opt.value}
                    id={`${listboxId}-opt-${i}`}
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(opt.value)}
                    onMouseEnter={() => setFocusIndex(i)}
                    className={cn(
                      "relative flex w-full cursor-default items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none",
                      i === focusIndex && "bg-accent text-accent-foreground",
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {opt.value === value && (
                      <CheckIcon className="absolute right-2 size-4" />
                    )}
                  </button>
                ))
              )}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

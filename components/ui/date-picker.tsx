// Calendar-based date picker — uses react-day-picker in a Base UI Popover
// Displays date in dd/MM/yyyy Vietnamese format, stores ISO YYYY-MM-DD
"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { format, parse } from "date-fns";
import { vi } from "date-fns/locale";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";

interface DatePickerProps {
  value: string; // ISO "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Chọn ngày",
  disabled = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const displayText = selected ? format(selected, "dd/MM/yyyy") : null;

  function handleSelect(day: Date | undefined) {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
      setOpen(false);
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <div className="relative w-full">
        <PopoverPrimitive.Trigger
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 h-8 dark:bg-input/30 dark:hover:bg-input/50",
            !displayText && "text-muted-foreground",
            displayText && "pr-7",
            className
          )}
        >
          <span className="flex-1 text-left">{displayText ?? placeholder}</span>
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        </PopoverPrimitive.Trigger>
        {displayText && !disabled && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Xóa ngày"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="bottom"
          sideOffset={4}
          align="start"
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup className="z-50 rounded-lg bg-popover p-3 shadow-md ring-1 ring-foreground/10 outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={handleSelect}
              defaultMonth={selected}
              locale={vi}
              showOutsideDays
              // Year+month selectable directly via dropdowns in the caption row.
              // Range: 10 years back to 5 years ahead — wide enough for typical bookkeeping data.
              captionLayout="dropdown"
              startMonth={new Date(new Date().getFullYear() - 20, 0)}
              endMonth={new Date(new Date().getFullYear() + 5, 11)}
              classNames={{
                months: "flex gap-4",
                month: "flex flex-col gap-2",
                month_caption: "flex items-center justify-center h-8 relative",
                // Hidden when captionLayout="dropdown" — dropdowns replace the static label
                caption_label: "sr-only",
                dropdowns: "flex items-center gap-1.5",
                dropdown_root: "relative inline-flex items-center",
                dropdown: "appearance-none rounded-md border border-input bg-transparent px-2 py-1 pr-6 text-sm hover:bg-accent cursor-pointer",
                nav: "flex items-center gap-1",
                button_previous: "absolute left-0 inline-flex items-center justify-center size-7 rounded-md hover:bg-accent hover:text-accent-foreground",
                button_next: "absolute right-0 inline-flex items-center justify-center size-7 rounded-md hover:bg-accent hover:text-accent-foreground",
                month_grid: "border-collapse",
                weekdays: "flex",
                weekday: "w-8 text-center text-xs font-medium text-muted-foreground",
                week: "flex mt-0.5",
                day: "size-8 p-0 text-center text-sm",
                day_button: "inline-flex size-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
                selected: "!bg-primary !text-primary-foreground hover:!bg-primary",
                today: "font-bold text-primary",
                outside: "text-muted-foreground/50",
                disabled: "text-muted-foreground/30",
              }}
              components={{
                Chevron: ({ orientation }) =>
                  orientation === "left" ? (
                    <ChevronLeftIcon className="size-4" />
                  ) : (
                    <ChevronRightIcon className="size-4" />
                  ),
              }}
            />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

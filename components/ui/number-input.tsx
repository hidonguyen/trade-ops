// Formatted number input — shows thousands separators on blur, raw digits on focus
// Stores raw numeric string, never formatted value
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  decimals?: number; // max decimal places (default 2)
  min?: number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}

// Format a numeric string with Vietnamese locale (dot as thousands separator)
function formatDisplay(raw: string, decimals: number): string {
  if (!raw || raw === "-") return raw;
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  return num.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function NumberInput({
  value,
  onChange,
  decimals = 2,
  min,
  placeholder = "0",
  disabled = false,
  readOnly = false,
  className,
}: NumberInputProps) {
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Display formatted value when blurred, raw when focused
  const displayValue = focused ? value : formatDisplay(value, decimals);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow empty, minus, digits, and single decimal point
    if (raw === "" || raw === "-" || /^-?\d*\.?\d*$/.test(raw)) {
      // Enforce max decimal places
      const dotIndex = raw.indexOf(".");
      if (dotIndex !== -1 && raw.length - dotIndex - 1 > decimals) return;
      onChange(raw);
    }
  }

  function handleFocus() {
    setFocused(true);
    // Select all text on focus for easy replacement
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function handleBlur() {
    setFocused(false);
    // Clean up trailing dot, enforce min on blur
    if (value && value !== "-") {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        const clamped = min !== undefined ? Math.max(min, num) : num;
        onChange(String(clamped));
      }
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-right font-mono tabular-nums transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30 dark:disabled:bg-input/80",
        readOnly && "bg-slate-50 dark:bg-input/50",
        className
      )}
    />
  );
}

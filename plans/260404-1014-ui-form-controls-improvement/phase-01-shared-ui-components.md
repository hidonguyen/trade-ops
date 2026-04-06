---
title: "Phase 1: Shared UI Components"
status: completed
priority: P2
effort: 4h
blocks: [phase-02, phase-03]
completed_date: 2026-04-04
---

# Phase 1: Shared UI Components

## Overview

Create 3 reusable form components: searchable Combobox, DatePicker, and FormattedNumberInput.

## Context Links

- [UI Select (current)](../../components/ui/select.tsx)
- [UI Input (current)](../../components/ui/input.tsx)
- [Design Guidelines](../../docs/design-guidelines.md)

---

## 1. Combobox (`components/ui/combobox.tsx`)

### Requirements
- Searchable dropdown with text filtering
- Shows label text in trigger after selection (not IDs)
- Keyboard navigation (arrow keys, Enter, Escape)
- Supports placeholder, disabled state, empty state
- Matches existing Select styling (border, height, rounded-lg, dark mode)

### Architecture
- Use Base UI `Popover` for dropdown positioning
- Native `<input>` inside popover for search filtering
- Controlled component: `value` (string ID), `onValueChange` callback
- `options: { value: string; label: string }[]` prop

### API Design

```tsx
interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Usage:
<Combobox
  value={form.partyId}
  onValueChange={(v) => setField("partyId", v)}
  options={parties.map(p => ({ value: p.id, label: p.name }))}
  placeholder="Chọn đối tác"
/>
```

### Implementation Steps

1. Create `components/ui/combobox.tsx`
2. Render trigger button showing selected option's **label** (or placeholder)
3. On click → open Base UI Popover with search input + scrollable list
4. Filter options by search text (case-insensitive, diacritics-insensitive via `normalize("NFD")`)
5. Highlight focused item, select on Enter/click
6. Close popover on selection or Escape
7. Style to match existing Select component (h-8, border-input, rounded-lg, etc.)

---

## 2. DatePicker (`components/ui/date-picker.tsx`)

### Requirements
- Calendar popup for date selection
- Displays selected date in Vietnamese format (dd/MM/yyyy)
- Supports min/max date constraints
- Month/year navigation
- Matches existing input styling

### Dependencies
- `react-day-picker` (v9) — headless calendar, accessible
- `date-fns` — date formatting/parsing

### API Design

```tsx
interface DatePickerProps {
  value: string;           // ISO "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Usage:
<DatePicker
  value={form.orderDate}
  onChange={(v) => setField("orderDate", v)}
  placeholder="Chọn ngày"
/>
```

### Implementation Steps

1. `npm install react-day-picker date-fns`
2. Create `components/ui/date-picker.tsx`
3. Trigger: button showing formatted date or placeholder, calendar icon
4. Popup: Base UI Popover containing `<DayPicker>` from react-day-picker
5. On day select → format to ISO string, call `onChange`, close popover
6. Style calendar with Tailwind classes matching design system
7. Vietnamese locale for day/month names via date-fns `vi` locale

---

## 3. NumberInput (`components/ui/number-input.tsx`)

### Requirements
- Display formatted number with thousands separators while viewing
- Raw number editing on focus (no separators while typing)
- Configurable decimal places (0 for VND, 2 for USD, 4 for amounts, 8 for exchange rates)
- Prevents non-numeric input
- Right-aligned, monospace font

### API Design

```tsx
interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  decimals?: number;        // max decimal places (default: 2)
  min?: number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}

// Usage:
<NumberInput
  value={form.amountOriginal}
  onChange={(v) => setField("amountOriginal", v)}
  decimals={4}
  placeholder="0.0000"
/>
```

### Implementation Steps

1. Create `components/ui/number-input.tsx`
2. Store raw string value internally
3. **On blur**: format with `toLocaleString("vi-VN")` for display (dots as thousands sep)
4. **On focus**: show raw value for editing
5. Validate keystrokes — allow digits, one decimal point, backspace, arrows
6. On change → parse, clamp decimals, call `onChange` with raw numeric string
7. Apply `text-right font-mono tabular-nums` styling
8. Match existing Input styling (h-8, border-input, etc.)

---

## Todo List

- [x] Create Combobox component with search filtering
- [x] Create DatePicker component with calendar popup
- [x] Install react-day-picker + date-fns
- [x] Create NumberInput component with formatting
- [x] Verify all 3 components render correctly in isolation
- [x] Run build to check for compile errors

## Success Criteria

- [x] Combobox filters options by typed text, shows label after selection
- [x] DatePicker shows calendar popup, outputs ISO date string
- [x] NumberInput shows "1.234.567" format on blur, raw digits on focus
- [x] All components match existing design system styling
- [x] No compile errors

## Completion Summary

Phase 1 successfully delivered all 3 reusable form control components:

1. **Combobox** (`components/ui/combobox.tsx`): Searchable dropdown with Base UI Popover, supports filtering by label text, keyboard navigation, and proper ARIA attributes.

2. **DatePicker** (`components/ui/date-picker.tsx`): Calendar-based date picker using react-day-picker + date-fns. Displays dates in Vietnamese format (dd/MM/yyyy). Includes clear button for easy reset.

3. **NumberInput** (`components/ui/number-input.tsx`): Formatted number input with thousands separators on blur, raw digit editing on focus. Configurable decimal places. Enforces min value constraints on blur.

All components follow existing design system patterns (h-8 height, border-input styling, rounded-lg, dark mode support).

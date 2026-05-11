# Phase 05 — Calendar year/month dropdown navigation

## Context

- `components/ui/date-picker.tsx` uses `react-day-picker` v9 (`^9.14.0` per `package.json`) wrapped in a Base UI Popover.
- Current calendar header (`month_caption`) shows the month label as plain text with chevron `button_previous` / `button_next` for nav. To pick Jan 2020 from May 2026, user must click 76 times.
- User wants: click YEAR text → year picker dropdown; click MONTH text → month picker dropdown. Direct jump, no chevron spam.

## Reinterpretation (vs original)

- Original phase title "year/month quick presets" misread the request as preset buttons next to the calendar.
- Correct scope: change the **calendar widget caption** to use dropdown selectors (year + month). No preset buttons, no changes to `components/shared/date-quick-presets.tsx`, no changes to filter bar.

## Upstream capability (react-day-picker v9)

- Prop `captionLayout` accepts: `"label"` (default plain text), `"dropdown"` (both month + year dropdowns), `"dropdown-months"`, `"dropdown-years"`.
- Setting `captionLayout="dropdown"` renders native `<select>` for month and year inside the caption — exactly what user wants.
- Required companion props:
  - `startMonth` / `endMonth` (Date objects) — bound the year-dropdown range. Without bounds, library defaults to a narrow window.
  - Keep `defaultMonth={selected}` so the calendar opens on the selected date's month.
- Reference: https://daypicker.dev/docs/customization (captionLayout)

## Requirements

- Year text in calendar header is a clickable dropdown listing a range of years.
- Month text is a clickable dropdown listing 12 months (in Vietnamese via existing `vi` locale).
- Selection in dropdown immediately re-renders the calendar grid for that year/month. Day click still emits the selected date as before (no behavior change to `onChange`).
- Year range: from `currentYear - 10` to `currentYear + 5` (conservative bounds, KISS — bookkeeping rarely needs more than 10 years back).

## Files

- Modify: `components/ui/date-picker.tsx` (only file).
- Read: react-day-picker v9 docs (already on installed version).

## Implementation steps

1. In `date-picker.tsx`, define year bounds:
   ```ts
   const now = new Date();
   const startMonth = new Date(now.getFullYear() - 10, 0);
   const endMonth = new Date(now.getFullYear() + 5, 11);
   ```
2. Pass to `<DayPicker>`:
   ```tsx
   captionLayout="dropdown"
   startMonth={startMonth}
   endMonth={endMonth}
   ```
3. Update `classNames` to style the new dropdown elements. v9 exposes:
   - `dropdowns`, `dropdown_root`, `dropdown` (the native `<select>`), `caption_label` (now visually hidden by RDP when dropdowns active — verify).
   - Apply minimal Tailwind classes so dropdowns match existing input/popover aesthetic (border, rounded, text-sm, padding). Keep month/year selects side-by-side via flex.
4. Verify the existing `Chevron` slot for prev/next still works alongside dropdown caption (RDP v9 keeps both — chevrons step ±1 month, dropdowns jump directly).
5. Smoke test:
   - Open any date picker (Order form, Transaction form, filter bar `date`/`date-range`).
   - Click year dropdown → select 2022 → grid jumps to 2022 same month.
   - Click month dropdown → select Tháng 3 → grid jumps to March same year.
   - Click a day → popover closes, `onChange` fires with ISO `YYYY-MM-DD`.
   - Confirm `defaultMonth={selected}` still respected on reopen.

## Todo

- [ ] Add `startMonth` / `endMonth` constants
- [ ] Set `captionLayout="dropdown"` on DayPicker
- [ ] Style `dropdowns`, `dropdown_root`, `dropdown` classNames
- [ ] Verify chevron prev/next still functional
- [ ] Visual QA on light theme
- [ ] Test on all consumer pages (orders, transactions, reports, audit-logs, forms)

## Success criteria

- Year and month appear as clickable dropdowns inside the calendar header.
- Selecting a year in dropdown shifts calendar to that year in the same month.
- Selecting a month in dropdown shifts calendar to that month in the same year.
- Day selection behavior unchanged (still emits `YYYY-MM-DD` via `onChange`).
- No regressions in any of the ~20 places `<DatePicker>` is used.

## Risks

- **Low**: RDP v9 dropdown CSS not styled → looks unstyled native. Mitigation: add `classNames.dropdowns` and `classNames.dropdown` Tailwind tokens.
- **Low**: Year bounds too narrow for historic records (>10 years). Mitigation: tune constants if user reports; KISS default.
- **Low**: Some browsers render native `<select>` differently. Acceptable; native is intentional for accessibility.

## Rollback

- Single-file change. Revert `captionLayout`, `startMonth`, `endMonth`, and added classNames in `date-picker.tsx`.

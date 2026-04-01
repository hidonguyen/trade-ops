# Trade Ops — Design Guidelines
**Version:** 1.0 | **Last Updated:** 2026-04-02 | **Status:** Active

---

## 1. Design Philosophy

Trade Ops is a professional financial management tool for Vietnamese import/export businesses. The design language follows **Swiss Modernism 2.0** applied to an enterprise SaaS context:

- **Clarity over decoration** — every pixel earns its place
- **Data-first** — tables, numbers, and status badges are first-class citizens
- **Trust & authority** — navy-blue hierarchy signals financial credibility
- **Vietnamese-native** — typography and layout support full diacritical mark rendering
- **Accessible by default** — WCAG 2.1 AA minimum, AA+ where feasible

---

## 2. Color System

### 2.1 Palette

```
Brand / Trust
  --color-primary:        #1E3A8A   (Deep Navy Blue)
  --color-primary-hover:  #1E40AF
  --color-primary-light:  #DBEAFE   (bg chips, selected rows)

Surfaces
  --color-bg:             #F8FAFC   (page background)
  --color-surface:        #FFFFFF   (cards, panels)
  --color-surface-raised: #F1F5F9   (inner sections, alt rows)

Text
  --color-text-primary:   #0F172A   (headings, labels)
  --color-text-secondary: #475569   (helper text, captions)
  --color-text-muted:     #94A3B8   (placeholders, disabled)

Border
  --color-border:         #E2E8F0
  --color-border-focus:   #1E3A8A

Sidebar
  --color-sidebar-bg:     #0F172A   (dark navy)
  --color-sidebar-text:   #CBD5E1
  --color-sidebar-active: #FFFFFF
  --color-sidebar-active-bg: #1E3A8A

Semantic — Order Status
  --color-unpaid-bg:      #F1F5F9   text: #475569   (Chưa thanh toán)
  --color-partial-bg:     #FEF9C3   text: #854D0E   (Thanh toán 1 phần)
  --color-paid-bg:        #DCFCE7   text: #166534   (Đã thanh toán)
  --color-partial-ref-bg: #FFEDD5   text: #9A3412   (Hoàn 1 phần)
  --color-refunded-bg:    #FEE2E2   text: #991B1B   (Đã hoàn tiền)

Semantic — General
  --color-success:        #16A34A
  --color-warning:        #D97706
  --color-danger:         #DC2626
  --color-info:           #0284C7
```

### 2.2 Usage Rules
- Primary blue: primary action buttons, active sidebar item, link hover
- Dark navy sidebar: always `#0F172A` regardless of page theme
- Status badge colors: never use raw hex inline — always use the semantic token
- Chart colors: bar series `#1E3A8A` (thu) / `#F59E0B` (chi); pie slices `#1E3A8A, #0284C7, #7C3AED`
- Never put primary blue text on white if font-size < 14px (contrast check)

---

## 3. Typography

### 3.1 Font Family

**Primary:** `IBM Plex Sans` — chosen for financial data legibility, tabular numeral support, and full Vietnamese character coverage.

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');

font-family: 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif;
```

**Monospace / Amounts:** `IBM Plex Mono` — for all monetary amounts in table cells, ensuring digit alignment.

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
```

### 3.2 Type Scale

| Token            | Size   | Weight | Line Height | Usage                          |
|------------------|--------|--------|-------------|--------------------------------|
| `text-display`   | 28px   | 700    | 1.2         | Page titles (rare)             |
| `text-heading-1` | 22px   | 700    | 1.3         | Card/panel headings            |
| `text-heading-2` | 18px   | 600    | 1.4         | Section sub-headings           |
| `text-heading-3` | 16px   | 600    | 1.4         | Table column headers           |
| `text-body`      | 14px   | 400    | 1.6         | Body text, form labels, cells  |
| `text-small`     | 13px   | 400    | 1.5         | Helper text, captions          |
| `text-micro`     | 12px   | 500    | 1.4         | Badges, chips, breadcrumbs     |
| `text-mono`      | 13px   | 400    | 1.5         | Currency amounts in cells      |

### 3.3 Number Formatting Rules
- All monetary amounts: `font-variant-numeric: tabular-nums; font-family: 'IBM Plex Mono'`
- VND: format with `.` thousand separator — `1.250.000 ₫`
- USD: `$1,250.00` — right-aligned in table columns
- RMB: `¥1,250.00`
- Negative/debit amounts: `--color-danger` red text

### 3.4 Currency Display (CRITICAL)
- **One amount column only** — show original currency amount with symbol inline (e.g., `$4,800.00`, `¥28,000.00`, `87.500.000 ₫`)
- **No separate Currency column** — the currency symbol in the amount is sufficient
- **No VND conversion** — do not show VND equivalent; the original amount is the source of truth
- For **aggregated views** (dashboard KPIs, report totals): VND as common denominator is fine
- Formatting: `$1,250.00` (USD), `¥1,250.00` (RMB), `1.250.000 ₫` (VND)

### 3.5 Vietnamese Text
- All body copy uses IBM Plex Sans which includes full Latin Extended Additional (Vietnamese glyphs)
- Test characters: `Ă ă Â â Đ đ Ê ê Ô ô Ơ ơ Ư ư` and all tonal marks
- Never use font-display: block for Vietnamese — use `swap` to prevent FOIT

---

## 4. Spacing System

Base unit: **4px** (Tailwind default). All spacing follows multiples of 4.

| Token      | Value | Tailwind   | Use                         |
|------------|-------|------------|-----------------------------|
| `space-1`  | 4px   | `p-1`      | Micro padding (badge)       |
| `space-2`  | 8px   | `p-2`      | Icon buttons                |
| `space-3`  | 12px  | `p-3`      | Table cell padding          |
| `space-4`  | 16px  | `p-4`      | Card padding (inner)        |
| `space-5`  | 20px  | `p-5`      | Section inner spacing       |
| `space-6`  | 24px  | `p-6`      | Card padding (outer)        |
| `space-8`  | 32px  | `p-8`      | Page horizontal padding     |
| `space-12` | 48px  | `p-12`     | Large section gap           |

---

## 5. Layout

### 5.1 App Shell

```
┌─────────────────────────────────────────────┐
│  HEADER (h-14, sticky)                      │
├──────────┬──────────────────────────────────┤
│ SIDEBAR  │  MAIN CONTENT                    │
│ w-60     │  flex-1, min-h-screen            │
│ (fixed)  │  px-8 py-6                       │
└──────────┴──────────────────────────────────┘
```

- Header height: `56px` (h-14)
- Sidebar width: `240px` (w-60) — collapsible to icon-only `64px` (w-16) on mobile
- Main content: `flex-1`, max-content-width `1280px`, centered with `px-8`
- Breakpoints: mobile `< 768px`, tablet `768–1023px`, desktop `≥ 1024px`

### 5.2 Grid
- Dashboard KPI cards: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`
- Charts row: `grid-cols-1 lg:grid-cols-2 gap-6`
- Form sections: `grid-cols-1 md:grid-cols-2 gap-4`

---

## 6. Component Patterns

### 6.1 Cards

```css
/* Base card */
background: #FFFFFF;
border: 1px solid #E2E8F0;
border-radius: 12px;
padding: 24px;
box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04);
```

KPI cards add a colored top-border accent (4px) matching the metric semantic color.

### 6.2 Data Tables

```
- thead: bg-slate-50, sticky top-0, text-xs font-600 uppercase tracking-wide text-slate-500
- tbody tr: hover:bg-slate-50, border-b border-slate-100
- td: px-4 py-3, text-sm
- Amount columns: text-right, font-mono tabular-nums
- Status column: centered badge
- Pagination: bottom, show "Hiển thị X–Y trong Z bản ghi"
```

Row selection: checkbox + `bg-blue-50` highlight on selected rows.

### 6.3 Status Badges

```html
<!-- Pattern: rounded-full px-2.5 py-0.5 text-xs font-medium -->
<span class="badge-unpaid">Chưa TT</span>       <!-- slate bg -->
<span class="badge-partial">Thanh toán 1 phần</span>  <!-- amber bg -->
<span class="badge-paid">Đã thanh toán</span>    <!-- green bg -->
<span class="badge-partial-ref">Hoàn 1 phần</span>    <!-- orange bg -->
<span class="badge-refunded">Đã hoàn tiền</span> <!-- red bg -->
```

### 6.4 Sidebar Navigation

```
Group header: text-xs font-600 uppercase tracking-widest text-slate-400 px-3 mb-1
Nav item:     flex items-center gap-3 px-3 py-2 text-sm rounded-lg
              text-slate-300 hover:bg-white/10 hover:text-white
Active item:  bg-blue-700 text-white font-500
Icon:         18px, stroke-width 1.5
```

Groups:
1. **Bán hàng** — Đơn bán, Khách hàng, Ký quỹ bán
2. **Mua hàng** — Đơn mua, Nhà cung cấp, Ký quỹ mua
3. **Thu Chi** — Giao dịch, Báo cáo dòng tiền
4. **Báo cáo** — Tổng hợp, Công nợ
5. **Cài đặt** — Người dùng, Cấu hình (ADMIN only)

### 6.5 Buttons

| Variant   | Style                                            | Use                   |
|-----------|--------------------------------------------------|-----------------------|
| Primary   | `bg-blue-800 text-white hover:bg-blue-900`       | Main CTA              |
| Secondary | `bg-white border border-slate-200 hover:bg-slate-50` | Secondary actions |
| Danger    | `bg-red-600 text-white hover:bg-red-700`         | Delete, cancel        |
| Ghost     | `text-slate-600 hover:bg-slate-100`              | Icon actions          |

All buttons: `rounded-lg`, `text-sm font-medium`, `h-9 px-4` (default), `h-8 px-3` (small).

### 6.6 Form Inputs

```
height: 36px (h-9)
border: 1px solid #E2E8F0
border-radius: 8px
padding: 0 12px
font-size: 14px
focus: border-blue-800 ring-2 ring-blue-200
error: border-red-500 ring-2 ring-red-100
```

Labels: `text-sm font-medium text-slate-700 mb-1`.
Error messages: `text-xs text-red-600 mt-1`.

### 6.7 Header

- Height: `56px`, `bg-white border-b border-slate-200 px-6`
- Left: Logo (Trade Ops wordmark, blue), divider, business unit selector dropdown
- Right: current user name, role chip, logout button
- Business unit selector: `<select>` styled as a pill — `rounded-full bg-blue-50 text-blue-800 px-3 py-1 text-sm font-medium`

---

## 7. Icon System

Use **Lucide icons** (matches shadcn/ui defaults).
- Size: `16px` for inline, `18px` for nav, `20px` for page headings
- Stroke-width: `1.5`
- Color: inherits from text color

---

## 8. Charts (recharts)

### Bar Chart (Thu/Chi by Month)
- Bar width: 20px, gap: 8px between pair
- Thu series: `#1E3A8A`
- Chi series: `#F59E0B`
- Grid: `stroke-dasharray="3 3" stroke="#E2E8F0"`
- Axis text: `#94A3B8` 12px
- Tooltip: white card, `border: 1px solid #E2E8F0`, `border-radius: 8px`

### Pie Chart (Currency Distribution)
- Slices: VND `#1E3A8A`, USD `#0284C7`, RMB `#7C3AED`
- Inner radius: 60% (donut)
- Legend: right-side list

---

## 9. Motion & Interaction

All motion respects `prefers-reduced-motion: reduce`.

| Interaction          | Duration | Easing             |
|----------------------|----------|--------------------|
| Button hover         | 150ms    | ease-out           |
| Sidebar collapse     | 250ms    | cubic-bezier(.4,0,.2,1) |
| Modal open/close     | 200ms    | ease-in-out        |
| Row hover            | 100ms    | ease-out           |
| Toast notification   | 300ms    | spring (ease-out)  |
| Tab switch           | 150ms    | ease-in-out        |

---

## 10. Multi-Currency Display Rules

- Always show original currency amount **and** VND equivalent
- Format: `$1,250.00 USD` on line 1, `≈ 32.500.000 ₫` on line 2 (text-slate-400 text-xs)
- In compact table cells: `$1,250 / 32.5tr ₫`
- Exchange rate tooltip on hover: `Tỷ giá: 1 USD = 26.000 VND`

---

## 11. Accessibility

- Color contrast: all text ≥ 4.5:1 on backgrounds (WCAG AA)
- Focus rings: visible 2px blue-200 ring on all interactive elements
- Keyboard navigation: full sidebar + table row traversal
- ARIA labels on icon-only buttons
- Status badges use both color AND text (not color alone)
- Touch targets: minimum `44×44px` on mobile

---

## 12. Naming Conventions

### CSS / Tailwind
- Component-level classes use BEM-like convention when extracting: `order-table__row--selected`
- Tailwind utilities preferred over custom CSS

### Component Files
- Pages: `app/(module)/page.tsx`
- Shared UI: `components/ui/` (shadcn primitives)
- Business components: `components/(module)/`
- Example: `components/orders/order-status-badge.tsx`

### Vietnamese Labels (canonical)
| Key                 | Label                    |
|---------------------|--------------------------|
| `status.UNPAID`     | Chưa thanh toán          |
| `status.PARTIAL_PAID` | Thanh toán 1 phần      |
| `status.PAID`       | Đã thanh toán            |
| `status.PARTIAL_REFUNDED` | Hoàn tiền 1 phần   |
| `status.REFUNDED`   | Đã hoàn tiền             |
| `type.SALE`         | Bán hàng                 |
| `type.PURCHASE`     | Mua hàng                 |
| `module.sales`      | Bán hàng & Phải thu      |
| `module.purchases`  | Mua hàng & Phải trả      |
| `module.cashflow`   | Thu Chi                  |
| `module.reports`    | Báo cáo                  |
| `module.settings`   | Cài đặt                  |

---

## 13. Responsive Breakpoints

| Name    | Min Width | Behavior                                     |
|---------|-----------|----------------------------------------------|
| mobile  | 320px     | Sidebar hidden (hamburger), single-col layout |
| tablet  | 768px     | Sidebar icon-only (w-16), 2-col grids        |
| desktop | 1024px+   | Full sidebar (w-60), 4-col KPI grid          |
| wide    | 1280px+   | Max content width, side-by-side charts       |

---

*End of Design Guidelines v1.0*

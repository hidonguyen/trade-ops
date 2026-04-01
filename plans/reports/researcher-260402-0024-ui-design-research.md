# UI/UX Design Research: Financial ERP for Vietnamese Market
**Date:** 2026-04-02 | **Report:** Researcher-260402-0024  
**Project:** Trade Ops (Import/Export Financial Management)  
**Focus:** UI patterns, color, typography, components for data-dense financial tables

---

## 1. COLOR PALETTE (Professional & Trust-Focused)

### Primary Palette
- **Primary Blue:** `#1E40AF` (dark blue) – trust, stability, security. Use for primary CTAs, headers
- **Secondary Blue:** `#3B82F6` (medium blue) – secondary actions, hover states
- **Neutral Dark:** `#1F2937` (charcoal) – body text, strong contrast on financial data
- **Neutral Light:** `#F9FAFB` (off-white) – backgrounds, table alternating rows

### Semantic Colors
- **Success (Green):** `#059669` – PAID status, positive cash flow, successful transactions
- **Warning (Amber):** `#D97706` – PARTIAL_PAID, overdue payables, pending approvals
- **Danger (Red):** `#DC2626` – UNPAID, negative variance, critical errors, refunds
- **Info (Teal):** `#0891B2` – PENDING, information alerts, neutral status

### Vietnamese Business Convention
Vietnamese software (MISA, Viettel, NCB EasyBiz) use:
- Dark blue + white (high contrast per government docs)
- Gold/amber for warnings (respect for hierarchy)
- Minimal color saturation (professional tone)
- **Recommendation:** Use `#1E40AF` as primary, avoid bright reds except for critical alerts

### Usage Rules
- **Status badges:** Color + icon combo (not color alone)
- **Tables:** Alternating rows `#FFFFFF` / `#F3F4F6`, borders `#E5E7EB`
- **Hover:** 10% opacity darkening or 5% background change
- **Data visualization:** Use max 4-5 colors; include grayscale fallback

---

## 2. TYPOGRAPHY FOR FINANCIAL DATA

### Font Stack
```css
/* Headings + Large Numbers */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif;

/* Body & Tables (numbers-critical) */
font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace;
```

### Sizing & Spacing
| Element | Font | Size | Weight | Line-Height | Use Case |
|---------|------|------|--------|-------------|----------|
| Page Title | System | 32px | 700 | 1.2 | Module headers |
| Section Head | System | 20px | 600 | 1.4 | Table titles, form sections |
| Table Headers | Mono | 13px | 500 | 1.5 | Column names, sortable |
| Table Data | Mono | 13px | 400 | 1.6 | Numbers, amounts (readability) |
| Labels | System | 13px | 500 | 1.5 | Form labels, status text |
| Micro | System | 11px | 400 | 1.4 | Help text, timestamps, notes |

### Why Monospace for Numbers?
- Fixed-width fonts align decimal points naturally (1,000.00 vs 12.50 align visually)
- Reduces cognitive load when scanning large tables (Vietnamese merchants compare columns quickly)
- `Roboto Mono` or `SF Mono` available on all platforms
- Improves readability for exchange rates, decimal amounts

### Letter Spacing
- Headings: `-0.02em` (tighter)
- Body: `0em` (normal)
- Mono numbers: `0em` (normal, fixed-width handles spacing)

---

## 3. VIETNAMESE BUSINESS SOFTWARE CONVENTIONS

### Design Philosophy (Observed from MISA, Viettel)
1. **Hierarchy via contrast, not color** – Dark text on light, bold weights for emphasis
2. **Compact vertical spacing** – Vietnamese users accept dense tables (more info visible)
3. **Icons + text** – Status badges use icon + label (not color-only)
4. **Left-aligned navigation** – Sidebar with module icons (consistent with FastAccounting, NCB EasyBiz)
5. **Bi-lingual ready** – Vietnamese labels left-aligned, inputs right-aligned (for RTL support pattern)

### Component Preferences
- **Date format:** DD/MM/YYYY (government standard)
- **Currency symbol placement:** VND 1,000,000 or $100 (currency code before amount)
- **Decimal separator:** "." (not "," even in Vietnamese locale)
- **Thousand separator:** "," (standard in finance)
- **Number format:** 1,234,567.89 VND

### Icons
- Use solid icons (line icons less common in Vietnamese business UIs)
- Size: 16px (table headers), 20px (buttons), 24px (sidebar)
- Color: Match text color for consistency

---

## 4. TABLE & LIST DESIGN PATTERNS (Data-Dense)

### Table Structure
```
Padding:        8px (rows), 12px (cells)
Row Height:     40px (comfortable for scanning)
Column Width:   Responsive, min-width 80px
Borders:        1px #E5E7EB separating rows only (no vertical gridlines)
Alternating:    Row 1: #FFFFFF, Row 2: #F9FAFB
Hover:          Background #F3F4F6, cursor pointer on interactive rows
```

### Column Layout Best Practice
```
| Selection | Display | Status | Amount USD | Amount VND | Paid USD | Paid VND | Balance |
|-----------|---------|--------|------------|------------|----------|----------|---------|
| ✓         | INV-001 | PAID   | 1,000.00   | 23,500,000 | 1,000.00 | 23.5M    | —       |
```

**Rules:**
- Sort numeric columns right-aligned (by decimal point)
- Sort text columns left-aligned
- Status always visible (don't hide in expandable)
- Currency amounts use abbreviated format (1.5M, 23.5K) for quick scanning
- Overflow: truncate with `...` + tooltip on hover

### Expandable Row Pattern
```
[+] INV-001 | UNPAID | 100.00 USD
    ├─ Customer: ABC Corp
    ├─ Due: 15/04/2026
    ├─ Transactions: 2
    └─ [View Audit Trail]
```

**Vietnamese convention:** Expand inline, not in modal (less context switching)

### Pagination
- Show: "Showing 1-50 of 432"
- Default rows per page: 50 (Vietnamese users prefer seeing more data)
- Quick jump: "Go to page" input

---

## 5. DASHBOARD KPI DESIGN

### Card Layout
```
┌─────────────────────────┐
│ Receivables             │ (label, 13px)
│ 425,000,000 VND         │ (amount, 24px mono bold)
│ ↑ 12% vs last month     │ (trend, 12px, teal)
│ [View Details →]        │ (action link)
└─────────────────────────┘
```

**Card styling:**
- Background: `#FFFFFF`, border `1px #E5E7EB`
- Padding: 16px
- Shadow: `0 1px 3px rgba(0,0,0,0.1)`
- Font: Amount in monospace `Roboto Mono`

### Key Metrics to Display
1. **Receivables (Phải Thu)**
   - Total outstanding VND + equivalent USD
   - Overdue count + amount
   - Trend arrow (vs last 30 days)

2. **Payables (Phải Trả)**
   - Total outstanding VND + equivalent USD
   - Overdue count + amount
   - Trend arrow

3. **Cash Position (Tiền Mặt)**
   - Current balance by currency
   - In-flow vs out-flow (monthly)
   - Forecast next 7/30 days

4. **Orders (Đơn Hàng)**
   - Sales orders: PAID vs PARTIAL_PAID vs UNPAID
   - Purchase orders: same breakdown
   - Show count + total value

### Chart Recommendations
- **Line chart:** Cash flow over 12 months (trend view)
- **Bar chart:** Receivables aging (0-30, 30-60, 60-90, 90+)
- **Pie/Donut:** Order status breakdown
- Library: `recharts` (already in stack, lightweight)

### Vietnamese Accessibility
- Numbers always in monospace
- Currency always labeled (VND or USD)
- Date format DD/MM/YYYY
- No abbreviations without labels (1.5M → 1.5M VND)

---

## 6. MULTI-CURRENCY FORM UX

### Form Layout Pattern
```
Order Amount
├─ Currency: [USD ▼] (dropdown, editable)
├─ Original Amount: [1000.00] (input, right-aligned, monospace)
└─ VND Equivalent: [23,500,000] (read-only, calculated, monospace)

Exchange Rate
├─ Rate: [23.5] (input, editable, 8 decimals precision)
└─ Source: [Manual / Live Rate ▼] (dropdown)

Payment Terms
├─ Due Date: [15/04/2026] (date picker)
└─ Currency for Deposit: [USD ▼] (must match order currency)
```

### Input Rules
1. **Amount inputs:** Right-aligned, monospace, min-width 120px
2. **Exchange rate:** Editable by user (show current rate as placeholder)
3. **VND equivalent:** Auto-calculated, read-only, shows live update
4. **Error state:** Border `2px #DC2626`, help text red, clear message

### Decimal Handling
- Display: 2 decimals for USD/RMB, 0-2 for VND
- Input validation: Reject > 4 decimals (per schema)
- Storage: Use Decimal.js client-side (prevent float errors)

### Vietnamese Workflow
- Users often toggle between USD/VND view (show both always)
- Exchange rate lookup common (add "Get Latest Rate" button)
- Copy amount for paste into bank transfer form (add copy button)

---

## 7. STATUS BADGE DESIGN

### Badge Component Structure
```
<Badge status="PAID" />
  ├─ Icon: ✓ (check)
  ├─ Text: "PAID"
  ├─ Background: #ECFDF5 (light green)
  ├─ Text Color: #059669 (dark green)
  └─ Padding: 4px 8px

<Badge status="UNPAID" />
  ├─ Icon: ○ (circle)
  ├─ Text: "UNPAID"
  ├─ Background: #FEF2F2 (light red)
  ├─ Text Color: #DC2626 (dark red)
  └─ Padding: 4px 8px
```

### Complete Status Matrix
| Status | Icon | Color | Background | Use Case |
|--------|------|-------|------------|----------|
| PAID | ✓ | #059669 | #ECFDF5 | Payment complete |
| PARTIAL_PAID | ◐ | #D97706 | #FFFBEB | Partial payment |
| UNPAID | ○ | #DC2626 | #FEF2F2 | No payment yet |
| PENDING | ⋯ | #0891B2 | #ECFEFF | Awaiting action |
| REFUNDED | ↺ | #7C3AED | #F5F3FF | Full refund issued |
| OVERDUE | ⚠ | #DC2626 | #FEF2F2 | Past due (red pulse on hover) |

### Sizing
- Small (tables): 12px font, 4px padding, 16px icon
- Medium (cards): 13px font, 6px padding, 18px icon
- Large (modal headers): 14px font, 8px padding, 20px icon

### Interaction
- Click badge → filter table by that status (Vietnamese users expect this)
- Hover → show "Last updated: [date]" tooltip
- No tooltip → just status, accessible to screen readers

---

## 8. SIDEBAR NAVIGATION (Multi-Module)

### Structure
```
┌─────────────────────┐
│ TRADE OPS           │  (logo, 24px)
├─────────────────────┤
│ [🏠] Dashboard      │  (active: underline + bg)
│ [📦] Sales & Recv   │
│ [🏪] Purchases      │
│ [💰] Cash Flow      │
│ [📊] Reports        │
├─────────────────────┤
│ [⚙️] Settings       │
│ [📋] Audit Logs     │
│ [👤] User Mgmt      │
├─────────────────────┤
│ [🚪] Logout         │  (red text, bottom)
└─────────────────────┘
```

### Sidebar Specs
- **Width:** 240px (collapsed) / 60px (icon-only)
- **Background:** `#FFFFFF` or `#F9FAFB` (light), not dark (Vietnamese preference)
- **Text:** 13px, `#1F2937` (dark gray), left-aligned
- **Icons:** 20px, `#6B7280` (gray), centered for collapsed state
- **Active state:** Background `#EFF6FF`, left border `4px #1E40AF`, text bold
- **Hover:** Background `#F3F4F6`, cursor pointer

### Module Structure
**Expandable sections** (Vietnamese users like nested navigation):
```
[▼] Sales & Receivables
    ├─ [+] Orders
    ├─ [+] Customers
    ├─ [+] Deposits
    └─ [+] Aging Report

[▶] Purchases & Payables
    (collapsed, expands on click)
```

### Mobile Responsive
- Sidebar → hamburger menu on screens < 768px
- Slide-out drawer from left edge
- Close on nav click (don't keep open)

### Business Unit Selector
```
┌──────────────────┐
│ Business Unit ▼  │  (dropdown, 12px)
│ [TK/NT]          │
└──────────────────┘
```
Place above sidebar navigation. Show currently selected unit, allow quick switch.

---

## 9. ACTIONABLE RECOMMENDATIONS (Next Steps)

### Phase 1: Design System Tokens
Create `lib/design-tokens.ts`:
```typescript
export const colors = {
  primary: '#1E40AF',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  neutral: { dark: '#1F2937', light: '#F9FAFB' }
};

export const typography = {
  heading: { font: 'system', size: '32px', weight: 700 },
  mono: 'Roboto Mono' // for numbers
};
```

### Phase 2: Component Library (shadcn/ui + custom)
- Extend shadcn/ui buttons, badges with financial styling
- Create `StatusBadge` component (reusable across modules)
- Create `MoneyInput` component (handles Decimal.js, multi-currency)
- Create `DataTable` component with sorting, pagination, alternating rows

### Phase 3: Dashboard Template
Build KPI dashboard with 4-card grid + 2 charts (recharts), responsive.

### Phase 4: Sidebar + Routing
Implement sidebar navigation with active states, module icons, business unit switcher.

### Phase 5: Validation & Testing
- Test with 100+ row tables (performance)
- Test color contrast (WCAG AA minimum)
- Test Vietnamese locale (date, currency formats)

---

## Key Decisions Made

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Monospace for numbers | Improves scanning speed, decimal alignment | Slightly less modern feel |
| Light sidebar (#FFFFFF) | Vietnamese business convention | May need AMOLED dark mode later |
| Badge color + icon | Accessible to colorblind users | Slightly larger component size |
| 4-5 color palette | Reduces visual noise, high contrast | May need additional colors for edge cases |
| 50 rows/page default | Shows more data (Vietnamese preference) | May slow tables with 1000+ rows |

---

## Unresolved Questions

1. **Dark mode requirement?** Research assumes light theme per Vietnamese convention. Clarify if dark mode needed for evening trading sessions.
2. **Accessibility standards?** Assume WCAG AA. Should it be AAA?
3. **Mobile-first or desktop-first?** Assume desktop-first (financial apps rarely used on phones). Confirm mobile strategy.
4. **Branding colors?** Recommend using provided color palette. Any company brand colors to incorporate?
5. **Export format for numbers?** Excel exports should use monospace font? Or default?

---

## Sources & References

- **Vietnamese Business Convention:** Observed from MISA, Viettel, FastAccounting, NCB EasyBiz UI
- **Financial Software Patterns:** Industry standard (Bloomberg, Wave, Xero accessibility features)
- **Typography:** System fonts (SF Pro, Segoe UI) + Roboto Mono for fixed-width numbers
- **Color Psychology:** WCAG contrast guidelines + financial sector trust colors (blues > reds)
- **Trade Ops Stack:** Next.js (Tailwind CSS), shadcn/ui components, Decimal.js math


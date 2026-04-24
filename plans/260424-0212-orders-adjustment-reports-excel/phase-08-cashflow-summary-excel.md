# Phase 08 — Cashflow summary Excel (replaces DOCX)

## Context Links

- Spec: §4 (hierarchical III/IV) + §4.2 (special rules) in prompt
- Existing DOCX route: `app/api/reports/summary/export/route.ts`
- Existing DOCX service: `lib/docx-summary-export-service.ts`
- UI: `app/(dashboard)/reports/summary/page.tsx` (button at line 214)

## Overview

- Priority: P1
- Status: completed
- Replaces the DOCX export on `/reports/summary` with a hierarchical Excel matching spec §4.1.
- After Excel is live and verified: **delete** DOCX route + service.

## Key Insights

- Current DOCX route builds per-BU `customerReceipts`, `otherReceipts`, `supplierPayments`, `otherPayments` arrays. Excel version reuses the same data shape, renders into a single sheet with hierarchy.
- Spec §4.2 special rules:
  - **Bank fees** from every transaction (that has `bankFeeOriginal`) must appear as separate lines in **IV.1.b Chi khác** using expenseType "Phí ngân hàng". The parent transaction stays in its natural section.
  - **Deposit transactions** shown in cashflow (as actual money movement when deposit was taken/given), but the **payment-from-deposit** (DepositUsage-linked tx) must be excluded to avoid double-count.
  - VND amounts already stored on each tx (`amountVnd`). No lookup needed.
  - Currency icon in output = tx's currency symbol (exceljs cell text, not an actual image).
- Section labels (VN):
  - `III. Các khoản phải thu`
    - `1. {buCode}`
      - `a. Thu từ khách hàng`  (orders SALE with PAYMENT tx in period)
      - `b. Thu khác`  (standalone RECEIPT tx in period, grouped by payment method)
  - `IV. Các khoản phải trả`
    - `1. {buCode}`
      - `a. Phải trả nhà cung cấp`  (orders PURCHASE with PAYMENT tx in period)
      - `b. Chi khác`  (standalone PAYMENT tx + bank fee sub-rows + supplier deposits + "Chi khác" tx)
- Columns for `a` sections (both III.a and IV.a): `STT | Đối tác | Mã ĐH | Ngày | Tiền tệ | Nợ cũ (nguyên tệ) | TT lần này (nguyên tệ) | Nợ còn lại (nguyên tệ) | Quy đổi VNĐ | Ghi chú`.
- Columns for `b` sections: `STT | Ngày | Người nộp/nhận | Nội dung | PTTT | Mã tham chiếu | Tiền tệ | Nguyên tệ | Quy đổi VNĐ | Ghi chú`.

## Requirements

**Functional**
- Single worksheet "Tổng hợp" with hierarchical rows.
- Sections rendered in order III→IV, with nested `1. TK` / `1. NT` etc. for each active BU.
- Each `a` or `b` subsection has its own header row (merged, bold) then column-header row, then data rows, then "TỔNG CỘNG" row.
- Bank fee rule: for each tx with `bankFeeOriginal > 0`, append a row to IV.1.{buCode}.b "Chi khác" section with:
  - expenseType label "Phí ngân hàng", amount = `bankFeeOriginal`, VND = `bankFeeVnd`, reference to parent tx via notes "(Phí NH cho GD #{parentId})".
  - **Party / "Người nộp" column: left blank** — bank fees are company expenses, not tied to a party. <!-- Updated: Validation Session 1 - blank party for unattached bank fees -->
- Deposit rule: include Deposit creation transactions (if represented as standalone tx) in III.b / IV.b. Exclude `paymentMethod=DEPOSIT` transactions from cashflow entirely (flagged via DepositUsage link).
- `b` sub-sections render as **flat list** (no sub-grouping). Single data block + one TỔNG CỘNG row at bottom. <!-- Updated: Validation Session 1 - flat list, no sub-grouping -->
- Filename: `bao-cao-tong-hop-{YYYYMMDD}-{YYYYMMDD}.xlsx`.

**Non-functional**
- Single Prisma round-trip per BU (as today).
- Replace DOCX generator cleanly (no dead imports).
- RBAC: `checkAccess(roles, "GET", "DASHBOARD")` (existing route uses same).

## Architecture

```
GET /api/reports/summary/export?dateFrom&dateTo
  → query active BUs
  → for each BU:
       orders (SALE+PURCHASE) with PAYMENT tx in period → III.a / IV.a rows
       standalone RECEIPT in period → III.b rows
       standalone PAYMENT in period → IV.b rows
       transactions in period with bankFeeOriginal > 0 → append to IV.b
  → exclude transactions with any DepositUsage row (paymentMethod=DEPOSIT)
  → buildCashflowSummaryWorkbook({ bus: [{ buCode, III_a, III_b, IV_a, IV_b }] }, from, to)
  → stream .xlsx
```

## Related Code Files

**Create**
- `/Users/hido/trade-ops/lib/excel-cashflow-summary-service.ts` (~200 LOC, split if larger)
  - `exportCashflowSummary(data, dateFrom, dateTo): Promise<Buffer>`
  - Internal renderers: `renderSectionA`, `renderSectionB`, `renderBuHeader`

**Modify**
- `/Users/hido/trade-ops/app/api/reports/summary/export/route.ts`
  - Swap DOCX generator for Excel service
  - Build bank-fee sub-rows from transactions query
  - Build deposit creation rows (query `Deposit` model, filter `createdAt` in range; include party + currency)
  - Exclude `paymentMethod=DEPOSIT` from standalone tx query (already tied to prior consumption)
  - Change response `Content-Type` + `Content-Disposition` to xlsx
- `/Users/hido/trade-ops/app/(dashboard)/reports/summary/page.tsx`
  - Rename button label "Xuất báo cáo tổng hợp" → same; icon from FileTextIcon to TableIcon optional
  - No URL change needed (reuses `/api/reports/summary/export`)

**Delete (after verification)**
- `/Users/hido/trade-ops/lib/docx-summary-export-service.ts`
- Remove `docx` from package.json if not used elsewhere (grep first)

## Implementation Steps

1. **Build service** `excel-cashflow-summary-service.ts`:
   - Define data shapes: `BuSection = { buCode, buName, customerReceipts, otherReceipts, supplierPayments, otherPayments }`.
   - `otherReceipts` + `otherPayments` extended with `expenseCategory: string | null`.
   - Render order: title row 1, date range row 2, blank, "III. Các khoản phải thu" merged bold, for each BU `1. {buCode}`, then `a.` and `b.` subsections each with their own column-header and TỔNG CỘNG row, blank spacer, then III totals? (spec doesn't require top-level III total — skip unless stakeholder asks).
   - Repeat for IV.
   - `b` subsection: **flat list — no sub-grouping**. One TỔNG CỘNG at bottom of each `b` section. <!-- Updated: Validation Session 1 -->
2. **Route update** `summary/export/route.ts`:
   - Extend transaction queries to include `expenseType` relation (phase 04 must be merged).
   - Add bank-fee row extraction: `prisma.transaction.findMany({ where: { businessUnitId, transactionDate: between, bankFeeOriginal: { gt: 0 } }, include: { currency, party? } })`.
   - For each such tx, emit synthetic row into `otherPayments` with expenseCategory="Phí ngân hàng", amount=bankFeeOriginal, VND=bankFeeVnd. Note: partyId not on Transaction — use `order.party` if linked else BU as placeholder.
   - Add deposit-creation rows: `prisma.deposit.findMany({ where: { businessUnitId, createdAt: between }, include: { party, currency } })`.
     - For customer deposits → III.b with expenseCategory="Cọc".
     - For supplier deposits → IV.b with expenseCategory="Cọc".
   - Exclude from standalone queries any tx with `paymentMethod = "DEPOSIT"` (DepositUsage-linked payments).
3. **UI** — no structural change to the page; button continues to call same export URL. Optionally rename button tooltip to indicate Excel output.
4. **Verify** side-by-side against spec sheet "ThuChi (BAOCAO TONGHOP HIEN TẠI" screenshot.
5. **After QA passes**: delete `docx-summary-export-service.ts` + its lone import. Run `grep -r "docx-summary" /Users/hido/trade-ops` to confirm no references.
6. `npx tsc --noEmit`; commit.

## Todo List

- [x] Create `excel-cashflow-summary-service.ts`
- [x] Define section renderers
- [x] Wire bank-fee sub-row extraction
- [x] Wire deposit-creation row extraction
- [x] Exclude DEPOSIT-method payments from standalone query
- [x] Update summary/export route to use Excel service
- [x] Update summary page button (optional label/icon tweak)
- [x] Manual test with spec reference data
- [x] Delete `docx-summary-export-service.ts`
- [x] Remove `docx` dep from package.json if unused
- [x] Verify filename matches `bao-cao-tong-hop-{YYYYMMDD}-{YYYYMMDD}.xlsx`

## Success Criteria

- Single `.xlsx` downloadable from `/reports/summary` page.
- Structure matches §4.1 hierarchy for each active BU.
- Bank fees appear exactly once (parent tx in original section + fee row in IV.b).
- Deposit-as-payment transactions NOT double-counted (excluded from standalone).
- Deposit creation rows appear in III.b or IV.b per party type.
- DOCX code fully removed after verification.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bank fee double-count (parent + fee-row both include fee) | H | H | Fee row = bankFeeOriginal only (NOT amountOriginal); parent row keeps amountOriginal with no fee added |
| Deposit exclusion misses edge case (refund from deposit) | M | M | Filter by `paymentMethod=DEPOSIT` (covers both PAYMENT and REFUND); verify with deposit report |
| Deleting DOCX service breaks other imports | L | H | Grep before delete; run tsc after |
| Section ordering wrong when BU has no data | L | L | Skip empty subsections entirely (no header) |
| VND amount mismatch vs existing deposit report | M | M | Reuse same `amountVnd` column from Transaction; don't recompute |

## Security Considerations

- Same as current DOCX route: DASHBOARD access via `checkAccess`.
- No additional PII exposure beyond what DOCX showed.

## Open Questions

- When a bank-fee transaction has no linked order, the fee-row Party column — show empty or BU name? Current plan: empty.
- Should `b` sections sub-group by `expenseCategory` OR by `paymentMethod` (spec says "PTTT" = payment method for Thu khác, ambiguous for Chi khác). Current plan: by `expenseCategory` for Chi khác, by `paymentMethod` for Thu khác. Confirm.
- Keep DOCX for a release as fallback, or remove immediately? Plan locks in immediate removal per user decision.

## Next Steps / Dependencies

- Unblocks phase 09 edge-case tests.
- Depends on phase 04 (expenseType on Transaction).

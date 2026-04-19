# Deposit Tracking Report

**Created:** 2026-04-19
**Status:** completed
**Priority:** medium
**Complexity:** medium (3 new files, 1 modified)

## Summary

New report page at `/reports/deposits` showing all deposit creation and usage history.
Answers: "Ai đặt cọc bao nhiêu, dùng bao nhiêu, còn lại bao nhiêu?"

## Data Model

**Deposit** — has `amountOriginal` (total deposited), `remainingOriginal` (current balance)
**DepositUsage** — linked to Transaction, signed amounts:
- Positive = deduction (trừ cọc: PAYMENT + DEPOSIT method)
- Negative = credit (đặt cọc/hoàn cọc: REFUND + DEPOSIT or manual deposit creation)

## Report Design

### Filters
- Từ ngày / Đến ngày (default: tuần này, with quick presets)
- Đối tác (party combobox)
- Tiền tệ (currency combobox)

### Table Columns

| # | Column | Source |
|---|--------|--------|
| 1 | Ngày | deposit.createdAt or usage.createdAt |
| 2 | Đối tác | deposit.party.name |
| 3 | Loại | Đặt cọc / Trừ cọc / Hoàn cọc |
| 4 | Số tiền | amount (nguyên tệ) |
| 5 | Số dư | deposit.remainingOriginal |
| 6 | Tiền tệ | deposit.currency.code |
| 7 | Đơn vị | deposit.businessUnit.code |
| 8 | Ghi chú | linked transaction bankReference or notes |

### Row Types
- **Đặt cọc** — Deposit creation (from DepositUsage with negative amount, or Deposit.createdAt)
- **Trừ cọc** — DepositUsage with positive amount (used for payment)
- **Hoàn cọc** — DepositUsage with negative amount linked to REFUND transaction

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [API endpoint](./phase-01-deposit-report-api.md) | pending | New API route |
| 2 | [Report page UI](./phase-02-deposit-report-page.md) | pending | New page + sidebar |

## Key Decisions

- Flatten deposits + usages into a single timeline (not nested)
- API returns flat list sorted by date, not grouped by deposit
- Each row = one event (deposit creation or usage)
- No Excel export initially (can add later)
- Page goes under `/reports/deposits`, sidebar under "Báo cáo"

## Dependencies
- None

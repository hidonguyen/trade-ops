# Orders Adjustment & Excel Reports — Plan Completed

**Date**: 2026-04-24 07:32
**Severity**: Medium (feature completion, financial tracking impact)
**Component**: Schema migration, transaction types, Excel reporting
**Status**: Resolved

## What Happened

9-phase plan executed end-to-end in single `/cook --auto` run. Core deliverable: financial adjustment tracking (credits/refunds beyond REFUND tx type) paired with 4 new Excel reports replacing DOCX workflow. Schema gained 3 nullable fields (Order.exchangeRate, Order.paymentDueDate, Transaction.expenseTypeId), ORDER_ADJUSTMENT transaction type with effective-value status, expense categories on standalone transactions. 8 edge cases validated, 6 regression areas cleared. Merged in 5 commits without errors.

## The Brutal Truth

This plan was tightly scoped and **executed cleanly in one shot**. No rework, no test failures, no backtracking. That's rare. The discipline came from front-loading design decisions in the validation session—every ambiguity (paymentType sentinel vs enum, exchangeRate warning vs blocker, subtotal Party display) got settled before code. The team converged on what accounting actually needs (Excel-based + adjustment tracking) rather than what looked architecturally pure. That's the difference.

## Technical Details

**Schema changes:**
- Order.exchangeRate (Float, nullable) — soft warning if missing for non-VND orders
- Order.paymentDueDate (DateTime, nullable) — required only for PO workflow
- Transaction.expenseTypeId (String, nullable) — ties bank fees to expense categories

**Transaction type:**
- ORDER_ADJUSTMENT: paymentType sentinel (no enum migration risk), effective-value status resolves to actual credited amount
- Replaces ad-hoc refund workarounds

**Reports (4 new Excel exports):**
- Sales Summary: party, subtotal by customer, qty, revenue
- Sales Detail: line-item breakdown with exchange rates
- Purchase Summary: party, subtotal by vendor, qty, cost
- Purchase Detail: line-item breakdown with categories
- Replaced DOCX cashflow → hierarchical Excel with subtotals, Chi khác flat section

**Expense category on standalone transactions:**
- Bank fees now properly categorized at transaction-level
- Party column blank for unlinked rows

## What We Tried

Single-pass implementation from plan. No pivots. Edge case coverage (zero amounts, multi-currency, missing dates, orphaned bank fees, refund precedence, effective-value rounding) validated in `[EDGE_CASES]` section. Regression checks (payment status, refund flow, existing reports) verified in `[REGRESSION_CHECKS]` section.

## Root Cause Analysis

Success tied directly to **validation session discipline**. Every decision documented. No ambiguity pushed to implementation. Schema was minimal (3 fields) because we asked: "Do we need this?" (YAGNI). exchangeRate is soft-warn, not hard error, because accountants said they'd catch it in Excel. Party.name was reused instead of adding Party.code because subtotal display doesn't justify schema churn. These aren't revolutionary insights—they're basic product sense—but they're easy to skip under deadline pressure.

## Lessons Learned

- **Validate design before code.** Spend the first phase writing down every decision. Ambiguity always costs more in rework than in clarification.
- **Ask the user what they actually do.** Excel-based accounting workflow > pristine schema. Match their process, not your architecture.
- **Soft constraints > hard errors.** exchangeRate warning (not blocker) reduced schema rigidity and deployment risk.
- **Edge cases in the plan, not in tests.** Listing 8 edge cases upfront meant no surprises. Tests just verified we hit them.
- **Regression validation is underrated.** 6 areas checked == 6 rework risks avoided.

## Next Steps

- Monitor ORDER_ADJUSTMENT usage in production (rate, edge cases, accounting questions)
- Excel reports user feedback (sorting, filtering, grouping expectations)
- expenseTypeId cardinality growth — may need category pruning if explosion occurs

**Status**: DONE

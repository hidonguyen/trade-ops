---
title: "Báo cáo dòng tiền — bổ sung cột giao dịch (Full scope)"
description: "Thêm Đối tác, Loại chi, Loại GD, PTTT, Mã đơn, Ghi chú(tooltip); REFUND hiển thị số âm; ẩn DEPOSIT-method mặc định + toggle"
status: completed
priority: P3
effort: 1.5h
branch: main
tags: [reports, cashflow, ux]
created: 2026-05-05
blockedBy: []
blocks: []
---

# Cashflow Report — Full Column Set

## User Decisions (validated)
1. **Đối tác + Loại chi tách 2 cột riêng**: `order.party.name` (cột Đối tác); `expenseType.name` (cột Loại chi). Tx-gắn-đơn → cột Loại chi rỗng. Tx độc lập → cột Đối tác rỗng.
2. **REFUND hiển thị số âm**: amount column shows `-X` cho `paymentType=REFUND`. PAYMENT giữ dương (màu đã phân biệt qua Loại badge).
3. **DEPOSIT-method filter mặc định**: ẩn tx có `paymentMethod=DEPOSIT` (movement nội bộ, không ảnh hưởng số dư NH thật). UI có toggle "Hiện cả giao dịch cọc".
4. **Full scope**: thêm Đối tác, Loại chi, Loại GD, PTTT, Mã đơn, Ghi chú (tooltip).

## Final Layout

```
STT | Ngày | Đơn vị | Loại | Loại GD | Đối tác | Loại chi | Mã đơn | PTTT | Nguyên tệ | Phí NH | Thực thu/chi | Quy đổi VND
```

13 cột. Bỏ "Tham chiếu" (gộp vào tooltip cùng Ghi chú). Bỏ "Tiền tệ" (đã có trong Nguyên tệ).

Tooltip mỗi row hiện: Tham chiếu, Ghi chú, Người tạo (createdBy).

## Sign Rule cho Nguyên tệ / Quy đổi VND / Thực thu/chi

| paymentType | Sign |
|-------------|------|
| PAYMENT | + (giữ nguyên) |
| REFUND | − (đảo dấu) |
| ADJUSTMENT | giữ nguyên (DB đã ký) |

`CurrencyAmount` đã hỗ trợ số âm (red + dấu trừ) → chỉ cần truyền `signedAmount`.

## DEPOSIT-method Filter

- API thêm query param `includeDeposit` (default `false`). Khi `false`, append `paymentMethod: { not: "DEPOSIT" }` vào where.
- Cashflow summary cards (`computeSummaries`) tính trên dataset đã filter — nhất quán.
- UI thêm checkbox "Hiện giao dịch cọc" (mặc định off) trong FilterBar. Toggle reload data.

## Phases
| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [API: expose fields + DEPOSIT filter](./phase-01-api-fields-and-filter.md) | completed | `app/api/cashflow-report/route.ts` |
| 2 | [UI: cột mới + signed amount + toggle](./phase-02-ui-columns-and-toggle.md) | completed | `app/(dashboard)/reports/cashflow/page.tsx` |
| 3 | [Excel export sync](./phase-03-excel-sync.md) | completed | `lib/excel-export-service.ts`, `app/api/cashflow-report/route.ts` |

## Dependencies
- Phase 1 → Phase 2 (UI cần data shape mới)
- Phase 1 → Phase 3 (Excel cần fields mới)

## Success Criteria
- Trang `/reports/cashflow` mặc định ẩn DEPOSIT-method tx.
- Toggle "Hiện cọc" → DEPOSIT tx xuất hiện, badge PTTT="Cọc".
- REFUND tx hiển thị `-X` đỏ ở Nguyên tệ + Quy đổi VND.
- Đối tác cột có giá trị cho tx-gắn-đơn (party.name); rỗng cho tx độc lập.
- Loại chi cột có giá trị cho tx độc lập (expenseType.name); rỗng cho tx-gắn-đơn.
- Hover row → tooltip hiện Tham chiếu + Ghi chú + Người tạo.
- Excel export khớp UI sau khi áp toggle.

## Rollback
- Per-file revert. No schema/API breaking changes (new fields additive; filter param default false preserves prior behaviour ONLY if user opts out — đây là behavior change, cần lưu ý).

## Risks
- **Behavior change DEPOSIT filter**: User cũ quen thấy tất cả tx. Mitigation: toggle visible + tooltip giải thích.
- **Sign-flipped REFUND breaks summary cards**: `computeSummaries` cộng amountOriginal. Cần điều chỉnh: refund cộng âm sẽ tự đảo `receipts/payments` đúng → kiểm tra logic.

## Open Questions
- Toggle DEPOSIT có persist trong localStorage không? Defer — tab persistence có sẵn cho dateFrom/To.
- Excel có cần tooltip-equivalent (notes/createdBy column) hay giữ phẳng? → Giữ trong Excel vì xls dễ filter/pivot.

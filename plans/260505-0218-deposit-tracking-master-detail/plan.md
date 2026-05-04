---
title: "Báo cáo theo dõi cọc — master-detail + ẩn refund-seed usage"
description: "Restructure /reports/deposits to master (Deposit creation) + detail (DepositUsage events). Skip REFUND-seed usage row. Sort asc. Auto-create deposit from refund inherits tx.notes."
status: completed
priority: P3
effort: 2h
branch: main
tags: [reports, deposits, ui]
created: 2026-05-05
blockedBy: []
blocks: []
---

# Deposit Tracking — Master-Detail Restructure

## Hiện trạng
- `app/api/reports/deposits/route.ts` flatten tất cả Deposit creation + Usage thành 1 timeline, sort desc. Cùng đối tác/cùng deposit nằm rải rác giữa các deposit khác.
- `app/(dashboard)/reports/deposits/page.tsx` render 1 bảng phẳng với cột Loại (Đặt cọc / Trừ cọc / Hoàn cọc).
- Auto-create deposit từ REFUND (`createDepositFromRefund`) tạo: Deposit (source=REFUND) + DepositUsage seed (amount=-X, "đảo dấu") trong cùng `$transaction`. Seed usage không có giá trị thông tin cho người xem (đã encoded qua source=REFUND).
- `Deposit.notes` không nhận default từ refund tx — phải user gõ tay.

## User Decisions (yêu cầu)
1. **Master-detail**: 1 group = 1 Deposit. Master row = Deposit creation. Detail rows = các DepositUsage (trừ/hoàn). Có thể expand/collapse.
2. **Hide REFUND-seed usage**: bỏ usage row tự sinh khi auto-create deposit (heuristic: `deposit.source = "REFUND"` AND usage là first-and-only-at-creation, OR chính xác hơn: usage có createdAt cách deposit.createdAt < 5s VÀ linked tx có paymentType=REFUND).
3. **Sort asc** theo (date + time): masters sort theo `deposit.createdAt` asc; detail sort theo `usage.createdAt` asc.
4. **Auto-create deposit notes**: `createDepositFromRefund` nhận thêm `notes` param; gán vào `Deposit.notes` để mặc định = tx.notes của REFUND. Caller (`upsertOrderTransactionDeposit`) đã có `args.partyContext` — thêm `notes`.

## Phases
| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [Service: pass notes from refund tx](./phase-01-service-pass-notes.md) | completed | `lib/deposit-deduction-service.ts`, callers |
| 2 | [API: master-detail shape + hide seed + sort asc](./phase-02-api-master-detail.md) | completed | `app/api/reports/deposits/route.ts` |
| 3 | [UI: expandable master-detail rendering](./phase-03-ui-master-detail.md) | completed | `app/(dashboard)/reports/deposits/page.tsx` |

## Dependencies
- Phase 2 → Phase 3 (UI consumes new shape)
- Phase 1 độc lập, có thể trước hoặc sau

## Response Shape (Phase 2)

```ts
type DepositMaster = {
  id: string;
  createdAt: string;          // ISO
  source: "MANUAL" | "REFUND";
  partyId: string;
  partyName: string;
  partyType: "CUSTOMER" | "SUPPLIER";
  buCode: string;
  currencyCode: string;
  currencySymbol: string;
  amountOriginal: string;     // initial
  remainingOriginal: string;  // current balance
  notes: string | null;
  usages: Array<{
    id: string;
    createdAt: string;
    amountOriginal: string;   // signed: + = trừ cọc, - = hoàn cọc (per current convention)
    eventType: "DEPOSIT_USED" | "DEPOSIT_REFUNDED";
    reference: string | null; // tx.bankReference || tx.notes
  }>;
};
```

API returns `DepositMaster[]` instead of flattened events.

## Hide-seed Logic (Phase 2)

```ts
const isSeedUsage =
  dep.source === "REFUND" &&
  dep.usages.length > 0 &&
  Math.abs(dep.usages[0].createdAt.getTime() - dep.createdAt.getTime()) < 5000 &&
  dep.usages[0].transaction?.paymentType === "REFUND" &&
  dep.usages[0].amountOriginal.equals(dep.amountOriginal.negated());
const visibleUsages = isSeedUsage ? dep.usages.slice(1) : dep.usages;
```

## Date Filter Semantics (clarification)

Hiện tại date filter áp dụng cho từng event. Sau master-detail, đổi thành: deposit hiển thị nếu master HOẶC bất kỳ usage nằm trong khoảng — đảm bảo không bỏ sót deposit có activity in-period dù created out-of-period. Document trong API.

## Success Criteria
- 1 deposit = 1 master row + N detail rows (expandable).
- Deposit có source=REFUND không hiển thị seed usage ở detail; vẫn hiển thị các usage thật về sau.
- Tất cả sắp xếp tăng dần theo `createdAt`.
- Khi tạo refund không có deposit existing, `Deposit.notes` mặc định = REFUND tx.notes.
- Master row có badge "Hoàn từ GD" nếu source=REFUND.

## Rollback
- Per-file revert. No schema change. Service signature additive (notes optional).

## Risks
- **Heuristic sai**: backfilled REFUND deposit có usage createdAt sai chenh nhỏ. Mitigation: kiểm tra trên DB trước commit Phase 2.
- **Date filter behavior change**: out-of-period created deposit có in-period usage giờ sẽ hiển thị. Acceptable theo logic người dùng (xem hoạt động trong kỳ).

## Open Questions
- Có cần bỏ luôn date filter cho master (chỉ filter usage)? Hay master created-in-period? → giữ master created-in-period cho đơn giản, mở rộng usage to all.

Wait clarification needed: nếu master created out-of-period nhưng có usage in-period, có hiển thị? → Đề xuất: hiện. Xác nhận với user nếu cần.

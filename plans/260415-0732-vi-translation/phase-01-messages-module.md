# Phase 01 — Create `lib/messages.ts`

## Overview
- Priority: Critical
- Status: pending

## Target module

```ts
// lib/messages.ts
// Centralized Vietnamese user-facing messages.
// Usage: import { MSG, notFound, fieldRequired } from "@/lib/messages";

export const MSG = {
  // Auth + RBAC
  unauthorized: "Chưa xác thực",
  accessDenied: "Không có quyền truy cập",

  // Generic
  validationFailed: "Dữ liệu không hợp lệ",
  internalError: "Lỗi hệ thống, vui lòng thử lại sau",
  networkError: "Lỗi kết nối máy chủ",
  unknownError: "Lỗi không xác định",

  // Data integrity
  orderNumberDuplicate: "Số đơn hàng đã tồn tại cho đối tác này trong đơn vị kinh doanh này",
  insufficientDeposit: "Số dư cọc không đủ",
  depositNotFound: "Không tìm thấy cọc",
  orderNotFound: "Không tìm thấy đơn hàng",
  transactionNotFound: "Không tìm thấy giao dịch",
  partyNotFound: "Không tìm thấy đối tác",
  businessUnitNotFound: "Không tìm thấy đơn vị kinh doanh",
  currencyNotFound: "Không tìm thấy tiền tệ",
  expenseTypeNotFound: "Không tìm thấy loại chi phí",
  userNotFound: "Không tìm thấy người dùng",

  // Operations
  cannotModifyFinancial: "Không thể sửa trường tài chính khi đã có giao dịch",
  orderNumberRequired: "Số đơn hàng là bắt buộc",

  // Deposit refund auto-create
  depositIdRequiredPayment: "Phải chọn cọc khi thanh toán bằng phương thức Cọc",
  partyIdRequiredRefund: "Cần chọn đối tác để tạo cọc mới cho giao dịch hoàn tiền",

  // Bank fee
  bankFeeOnlyForBank: "Phí ngân hàng chỉ áp dụng cho phương thức Ngân hàng",
  bankFeeFieldsPair: "Phí (gốc) và Phí (VND) phải được điền cùng nhau",

  // Expense type
  expenseTypeSaleForbidden: "Loại chi phí chỉ áp dụng cho đơn mua",
} as const;

// Helpers — compose readable messages without string-interp at call sites
export const notFound = (entity: string) => `Không tìm thấy ${entity}`;
export const fieldRequired = (field: string) => `${field} là bắt buộc`;
export const fieldInvalid = (field: string) => `${field} không hợp lệ`;
export const mustBePositive = () => "Giá trị phải là số dương";
export const mustBeNonNegative = () => "Giá trị không được âm";
export const mustBeUuid = () => "Định dạng ID không hợp lệ";
export const maxLength = (n: number) => `Tối đa ${n} ký tự`;
```

## Files

- Create: `lib/messages.ts`

## Todo

- [ ] Write `lib/messages.ts` with constants + helpers
- [ ] `npm run type-check`

## Success Criteria

- Module exports compile.
- All strings use Vietnamese with diacritics.

## Risks

- Keep scope lean — don't add constants that have no caller yet. Add more as Phase 02/03 discovers need.

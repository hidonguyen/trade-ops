// Centralized Vietnamese user-facing messages.
// Usage: import { MSG, notFound, fieldRequired } from "@/lib/messages";
// Goal: all user-facing strings (API responses, zod errors, toasts) live here.
// Keep English only for technical identifiers (route paths, stack traces).

export const MSG = {
  // Auth + RBAC
  unauthorized: "Chưa xác thực",
  accessDenied: "Không có quyền truy cập",
  accessDeniedForType: "Không có quyền với loại dữ liệu yêu cầu",

  // Generic
  validationFailed: "Dữ liệu không hợp lệ",
  internalError: "Lỗi hệ thống, vui lòng thử lại sau",
  networkError: "Lỗi kết nối máy chủ",
  unknownError: "Lỗi không xác định",

  // Not found — common entities
  orderNotFound: "Không tìm thấy đơn hàng",
  transactionNotFound: "Không tìm thấy giao dịch",
  depositNotFound: "Không tìm thấy cọc",
  partyNotFound: "Không tìm thấy đối tác",
  businessUnitNotFound: "Không tìm thấy đơn vị kinh doanh",
  currencyNotFound: "Không tìm thấy tiền tệ",
  expenseTypeNotFound: "Không tìm thấy loại chi phí",
  userNotFound: "Không tìm thấy người dùng",

  // Data integrity / operations
  orderNumberDuplicate: "Số đơn hàng đã tồn tại cho đối tác này trong đơn vị kinh doanh này",
  orderNumberDuplicateShort: "Số đơn trùng với đơn hàng khác",
  orderNumberRequired: "Số đơn hàng là bắt buộc",
  cannotModifyFinancial: "Không thể sửa trường tài chính khi đã có giao dịch",
  insufficientDeposit: "Số dư cọc không đủ",
  overpaymentExceeded: "Số tiền thanh toán vượt quá số tiền còn phải thanh toán",
  overRefundExceeded: "Số tiền hoàn không được vượt quá số tiền đã thanh toán",
  depositCurrencyMismatch: "Tiền tệ của cọc không khớp với tiền tệ giao dịch",
  businessUnitRequired: "Không tìm thấy đơn vị kinh doanh",

  // Deposit edit/delete guards
  depositLockedHasUsages: "Cọc đã có giao dịch liên quan; không thể thay đổi tiền tệ / đơn vị",
  depositDeleteBlockedHasUsages: "Cọc đã được sử dụng; không thể xóa",

  // Deposit refund auto-create
  depositIdRequiredPayment: "Phải chọn cọc khi thanh toán bằng phương thức Cọc",
  partyIdRequiredRefund: "Cần chọn đối tác để tạo cọc mới cho giao dịch hoàn tiền",

  // Bank fee
  bankFeeOnlyForBank: "Phí ngân hàng chỉ áp dụng cho phương thức Ngân hàng",
  bankFeeFieldsPair: "Phí (gốc) và Phí (VND) phải được điền cùng nhau",

  // Adjustment transaction
  adjustmentBankFeeNotAllowed: "Giao dịch điều chỉnh không được có phí ngân hàng",
  adjustmentDepositNotAllowed: "Giao dịch điều chỉnh không được liên kết với cọc",
  adjustmentPaymentTypeMismatch: "Giao dịch điều chỉnh phải có loại thanh toán là ADJUSTMENT",
  adjustmentAmountNonZero: "Số tiền điều chỉnh không được bằng 0",

  // Expense type
  expenseTypeSaleForbidden: "Loại chi phí chỉ áp dụng cho đơn mua",
  expenseTypeNotApplicable: "Không áp dụng cho đơn bán",

  // Transaction-related UX
  transactionCreateFailed: "Lỗi tạo giao dịch",
  transactionUpdateFailed: "Lỗi cập nhật giao dịch",
  transactionDeleteFailed: "Lỗi xóa giao dịch",
  orderCreateFailed: "Lỗi tạo đơn hàng",
  orderUpdateFailed: "Lỗi cập nhật đơn hàng",
  orderNotFoundGeneric: "Không tìm thấy đơn hàng",

  // Reference data load
  referenceDataLoadFailed: "Không thể tải dữ liệu tham chiếu",
  depositsLoadFailed: "Không thể tải danh sách cọc",
} as const;

// Parameterized helpers — compose readable messages without string-interp at call sites.
export const depositAmountBelowUsed = (used: string) =>
  `Số tiền mới phải lớn hơn hoặc bằng phần đã sử dụng (${used})`;
export const notFound = (entity: string) => `Không tìm thấy ${entity}`;
export const fieldRequired = (field: string) => `${field} là bắt buộc`;
export const fieldInvalid = (field: string) => `${field} không hợp lệ`;
export const maxLength = (n: number) => `Tối đa ${n} ký tự`;
export const minLength = (n: number) => `Tối thiểu ${n} ký tự`;
export const mustBePositive = () => "Phải là số dương";
export const mustBeNonNegative = () => "Không được âm";
export const mustBeValidDecimal = () => "Phải là số thập phân hợp lệ";
export const mustBeValidUuid = () => "Định dạng ID không hợp lệ";

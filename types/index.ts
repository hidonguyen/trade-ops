// Core domain enums and shared API types for Trade Ops

// Order lifecycle states
export const OrderStatus = {
  UNPAID: "UNPAID",
  PARTIAL_PAID: "PARTIAL_PAID",
  PAID: "PAID",
  PARTIAL_REFUNDED: "PARTIAL_REFUNDED",
  REFUNDED: "REFUNDED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PartyType = {
  CUSTOMER: "CUSTOMER",
  SUPPLIER: "SUPPLIER",
  BOTH: "BOTH",
} as const;
export type PartyType = (typeof PartyType)[keyof typeof PartyType];

export const OrderType = {
  SALE: "SALE",
  PURCHASE: "PURCHASE",
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const TransactionType = {
  SALE_PAYMENT: "SALE_PAYMENT",
  PURCHASE_PAYMENT: "PURCHASE_PAYMENT",
  RECEIPT: "RECEIPT",
  PAYMENT: "PAYMENT",
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const PaymentMethod = {
  BANK: "BANK",
  DEPOSIT: "DEPOSIT",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentType = {
  PAYMENT: "PAYMENT",
  REFUND: "REFUND",
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const UserRole = {
  ADMIN: "ADMIN",
  ACCOUNTANT_SALE: "ACCOUNTANT_SALE",
  ACCOUNTANT_PURCHASE: "ACCOUNTANT_PURCHASE",
  ACCOUNTANT_CASHFLOW: "ACCOUNTANT_CASHFLOW",
  VIEWER: "VIEWER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

// Standard API envelope
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// RBAC permission types
export type RbacAction = "GET" | "CREATE" | "UPDATE" | "DELETE";
export type RbacModule =
  | "SALE"
  | "PURCHASE"
  | "CUSTOMER"
  | "SUPPLIER"
  | "RECEIPT"
  | "PAYMENT"
  | "CASHFLOW"
  | "DASHBOARD"
  | "ADMIN";
export type RbacPermission = "FULL" | "GET" | "DENY";

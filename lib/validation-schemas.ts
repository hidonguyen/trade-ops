// Zod validation schemas for all API request bodies
import { z } from "zod";
import Decimal from "decimal.js";

// Reusable decimal validators
export const decimalString = z.string().refine(
  (val) => {
    try {
      const d = new Decimal(val);
      return d.isFinite() && d.greaterThan(0);
    } catch {
      return false;
    }
  },
  { message: "Must be a valid positive decimal number" }
);

export const decimalStringOrZero = z.string().refine(
  (val) => {
    try {
      const d = new Decimal(val);
      return d.isFinite() && d.greaterThanOrEqualTo(0);
    } catch {
      return false;
    }
  },
  { message: "Must be a valid non-negative decimal number" }
);

const decimalAny = z.string().refine(
  (val) => {
    try {
      new Decimal(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Must be a valid decimal number" }
);

const dateField = z
  .string()
  .datetime()
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.string().default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// Settings entities
export const createBusinessUnitSchema = z.object({
  code: z.string().min(2).max(3),
  name: z.string().min(1).max(100),
});

export const createCurrencySchema = z.object({
  code: z.string().length(3),
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(5),
});

export const createExpenseTypeSchema = z.object({
  name: z.string().min(1).max(100),
});

// Party (customer/supplier)
export const createPartySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
  businessUnitId: z.string().uuid(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
  taxId: z.string().max(20).optional(),
});

// Deposit
export const createDepositSchema = z.object({
  currencyId: z.string().uuid(),
  amountOriginal: decimalString,
  businessUnitId: z.string().uuid(),
});

// Order
export const createOrderSchema = z.object({
  businessUnitId: z.string().uuid(),
  partyId: z.string().uuid(),
  type: z.enum(["SALE", "PURCHASE"]),
  amountOriginal: decimalString,
  currencyId: z.string().uuid(),
  orderDate: dateField,
  notes: z.string().max(1000).optional(),
});

// Order-linked transaction (payment/refund on an order)
export const createOrderTransactionSchema = z.object({
  type: z.enum(["SALE_PAYMENT", "PURCHASE_PAYMENT"]),
  paymentMethod: z.enum(["BANK", "DEPOSIT"]),
  paymentType: z.enum(["PAYMENT", "REFUND"]),
  amountOriginal: decimalString,
  currencyId: z.string().uuid(),
  amountVnd: decimalString,
  exchangeRate: decimalAny,
  bankReference: z.string().max(100).optional(),
  transactionDate: dateField,
  notes: z.string().max(1000).optional(),
  depositId: z.string().uuid().optional(),
});

// Standalone transaction (receipt/payment not tied to an order)
export const createStandaloneTransactionSchema = z.object({
  type: z.enum(["RECEIPT", "PAYMENT"]),
  businessUnitId: z.string().uuid(),
  paymentMethod: z.enum(["BANK", "DEPOSIT"]),
  paymentType: z.enum(["PAYMENT", "REFUND"]),
  amountOriginal: decimalString,
  currencyId: z.string().uuid(),
  amountVnd: decimalString,
  exchangeRate: decimalAny,
  bankReference: z.string().max(100).optional(),
  transactionDate: dateField,
  notes: z.string().max(1000).optional(),
  depositId: z.string().uuid().optional(),
});

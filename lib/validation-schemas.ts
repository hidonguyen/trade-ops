// Zod validation schemas for all API request bodies
import { z } from "zod";
import Decimal from "decimal.js";
import { MSG } from "@/lib/messages";

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
  { message: "Phải là số dương hợp lệ" }
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
  { message: "Phải là số không âm hợp lệ" }
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
  { message: "Phải là số hợp lệ" }
);

const dateField = z
  .string()
  .datetime()
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .transform((val) => new Date(val));

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
  orderNumberMode: z.enum(["MANUAL", "AUTO"]).optional(),
  isActive: z.boolean().optional(),
});

export const createCurrencySchema = z.object({
  code: z.string().length(3),
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(5),
  isActive: z.boolean().optional(),
});

export const createExpenseTypeSchema = z.object({
  name: z.string().min(1).max(100),
  isActive: z.boolean().optional(),
});

// Party (customer/supplier)
export const createPartySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["CUSTOMER", "SUPPLIER"]),
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
  notes: z.string().max(2000).optional().nullable(),
});

// All fields optional — at least one must be present (enforced in route handler)
export const updateDepositSchema = z.object({
  currencyId: z.string().uuid().optional(),
  amountOriginal: decimalString.optional(),
  businessUnitId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

// Order
// orderNumber may be empty (AUTO mode generates server-side); API enforces presence for MANUAL mode.
// expenseTypeId only allowed on PURCHASE orders (reject on SALE to avoid contamination).
// exchangeRate: exchange rate to VND (positive decimal, default "1" for VND orders)
// paymentDueDate: optional due date for payment
export const createOrderSchema = z
  .object({
    businessUnitId: z.string().uuid(),
    partyId: z.string().uuid(),
    orderNumber: z.string().max(50).optional(),
    type: z.enum(["SALE", "PURCHASE"]),
    amountOriginal: decimalString,
    currencyId: z.string().uuid(),
    orderDate: dateField,
    notes: z.string().max(1000).optional(),
    expenseTypeId: z.string().uuid().optional().nullable(),
    exchangeRate: decimalString.default("1"),
    paymentDueDate: dateField.optional().nullable(),
  })
  .refine((d) => d.type !== "SALE" || !d.expenseTypeId, {
    message: MSG.expenseTypeSaleForbidden,
    path: ["expenseTypeId"],
  });

// Bank fee fields — only valid when paymentMethod = BANK.
// Both must be provided together (original in tx currency, VND computed client-side).
const bankFeeFields = {
  bankFeeOriginal: decimalStringOrZero.optional(),
  bankFeeVnd: decimalStringOrZero.optional(),
};

// Refinement: fee only when BANK; both fields must coexist
function refineBankFee<T extends { paymentMethod: string; bankFeeOriginal?: string; bankFeeVnd?: string }>(
  schema: z.ZodType<T>
) {
  return schema
    .refine(
      (d) =>
        d.paymentMethod === "BANK" ||
        ((!d.bankFeeOriginal || d.bankFeeOriginal === "0") && (!d.bankFeeVnd || d.bankFeeVnd === "0")),
      { message: MSG.bankFeeOnlyForBank, path: ["bankFeeOriginal"] }
    )
    .refine((d) => Boolean(d.bankFeeOriginal) === Boolean(d.bankFeeVnd), {
      message: MSG.bankFeeFieldsPair,
      path: ["bankFeeVnd"],
    });
}

// Refinement: DEPOSIT method rules.
//   PAYMENT + DEPOSIT → depositId required (no auto-create for payments)
//   REFUND  + DEPOSIT → depositId optional (auto-create path allowed). If standalone
//                       and no depositId, partyId is required to seed the new deposit.
function refineDepositRules<
  T extends {
    paymentMethod: string;
    paymentType: string;
    depositId?: string;
    partyId?: string;
  }
>(schema: z.ZodType<T>, requirePartyIdWhenAutoCreate: boolean) {
  return schema
    .refine(
      (d) => d.paymentMethod !== "DEPOSIT" || d.paymentType !== "PAYMENT" || Boolean(d.depositId),
      { message: MSG.depositIdRequiredPayment, path: ["depositId"] }
    )
    .refine(
      (d) => {
        if (!requirePartyIdWhenAutoCreate) return true;
        if (d.paymentMethod !== "DEPOSIT") return true;
        if (d.paymentType !== "REFUND") return true;
        if (d.depositId) return true;
        return Boolean(d.partyId);
      },
      { message: MSG.partyIdRequiredRefund, path: ["partyId"] }
    );
}

// Order-linked transaction (payment/refund/adjustment on an order)
// ORDER_ADJUSTMENT type: signed amountOriginal, no bank fee, no deposit, paymentType = ADJUSTMENT
const _orderTxBase = z.object({
  type: z.enum(["SALE_PAYMENT", "PURCHASE_PAYMENT", "ORDER_ADJUSTMENT"]),
  paymentMethod: z.enum(["BANK", "DEPOSIT"]),
  paymentType: z.enum(["PAYMENT", "REFUND", "ADJUSTMENT"]),
  // amountOriginal is validated in refinements below based on type
  amountOriginal: z.string(),
  currencyId: z.string().uuid(),
  // amountVnd validated in refinements below: positive for PAYMENT/REFUND, signed non-zero for ADJUSTMENT
  amountVnd: z.string(),
  exchangeRate: decimalAny,
  bankReference: z.string().max(100).nullable().optional(),
  transactionDate: dateField,
  notes: z.string().max(1000).nullable().optional(),
  depositId: z.string().uuid().optional(),
  ...bankFeeFields,
});

export const createOrderTransactionSchema = refineDepositRules(
  refineBankFee(_orderTxBase)
    // For PAYMENT/REFUND: amountOriginal must be strictly positive decimal
    .refine(
      (d) => {
        if (d.type === "ORDER_ADJUSTMENT") return true;
        try {
          const dec = new Decimal(d.amountOriginal);
          return dec.isFinite() && dec.greaterThan(0);
        } catch {
          return false;
        }
      },
      { message: "Phải là số dương hợp lệ", path: ["amountOriginal"] }
    )
    // For ADJUSTMENT: amountOriginal must be a valid non-zero decimal (can be negative)
    .refine(
      (d) => {
        if (d.type !== "ORDER_ADJUSTMENT") return true;
        try {
          const dec = new Decimal(d.amountOriginal);
          return dec.isFinite() && !dec.isZero();
        } catch {
          return false;
        }
      },
      { message: MSG.adjustmentAmountNonZero, path: ["amountOriginal"] }
    )
    // amountVnd: positive for PAYMENT/REFUND; signed non-zero for ADJUSTMENT (sign follows amountOriginal)
    .refine(
      (d) => {
        try {
          const dec = new Decimal(d.amountVnd);
          if (!dec.isFinite()) return false;
          if (d.type === "ORDER_ADJUSTMENT") return !dec.isZero();
          return dec.greaterThan(0);
        } catch {
          return false;
        }
      },
      { message: "Phải là số dương hợp lệ", path: ["amountVnd"] }
    )
    // ADJUSTMENT: paymentType must be ADJUSTMENT
    .refine(
      (d) => d.type !== "ORDER_ADJUSTMENT" || d.paymentType === "ADJUSTMENT",
      { message: MSG.adjustmentPaymentTypeMismatch, path: ["paymentType"] }
    )
    // ADJUSTMENT: bank fee fields must be absent
    .refine(
      (d) =>
        d.type !== "ORDER_ADJUSTMENT" ||
        ((!d.bankFeeOriginal || d.bankFeeOriginal === "0") &&
          (!d.bankFeeVnd || d.bankFeeVnd === "0")),
      { message: MSG.adjustmentBankFeeNotAllowed, path: ["bankFeeOriginal"] }
    )
    // ADJUSTMENT: depositId must be absent
    .refine(
      (d) => d.type !== "ORDER_ADJUSTMENT" || !d.depositId,
      { message: MSG.adjustmentDepositNotAllowed, path: ["depositId"] }
    ),
  // Order-linked: partyId comes from order server-side, no need to validate
  false
);

// Standalone transaction (receipt/payment not tied to an order)
export const createStandaloneTransactionSchema = refineDepositRules(
  refineBankFee(
    z.object({
      type: z.enum(["RECEIPT", "PAYMENT"]),
      businessUnitId: z.string().uuid(),
      paymentMethod: z.enum(["BANK", "DEPOSIT"]),
      paymentType: z.enum(["PAYMENT", "REFUND"]),
      amountOriginal: decimalString,
      currencyId: z.string().uuid(),
      amountVnd: decimalString,
      exchangeRate: decimalAny,
      bankReference: z.string().max(100).nullable().optional(),
      transactionDate: dateField,
      notes: z.string().max(1000).nullable().optional(),
      depositId: z.string().uuid().optional(),
      // partyId is required when auto-creating a deposit on REFUND + DEPOSIT
      partyId: z.string().uuid().optional(),
      expenseTypeId: z.string().uuid().nullable().optional(),
      ...bankFeeFields,
    })
  ),
  true
);

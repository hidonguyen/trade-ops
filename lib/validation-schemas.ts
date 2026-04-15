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
// orderNumber may be empty (AUTO mode generates server-side); API enforces presence for MANUAL mode.
// expenseTypeId only allowed on PURCHASE orders (reject on SALE to avoid contamination).
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

// Order-linked transaction (payment/refund on an order)
export const createOrderTransactionSchema = refineDepositRules(
  refineBankFee(
    z.object({
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
      ...bankFeeFields,
    })
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
      bankReference: z.string().max(100).optional(),
      transactionDate: dateField,
      notes: z.string().max(1000).optional(),
      depositId: z.string().uuid().optional(),
      // partyId is required when auto-creating a deposit on REFUND + DEPOSIT
      partyId: z.string().uuid().optional(),
      ...bankFeeFields,
    })
  ),
  true
);

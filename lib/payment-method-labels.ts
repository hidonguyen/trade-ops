// Shared payment method constants and labels used across the app
// Single source of truth — avoids duplicating BANK/DEPOSIT/CASH label maps in every component

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK: "Ngân hàng",
  DEPOSIT: "Cọc",
  CASH: "Tiền mặt",
};

export const PAYMENT_METHODS = ["BANK", "DEPOSIT", "CASH"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Returns the Vietnamese display label for a paymentMethod code. Falls back to the raw code. */
export function getPaymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/** Select/combobox options for payment method pickers */
export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((m) => ({
  value: m,
  label: PAYMENT_METHOD_LABELS[m],
}));

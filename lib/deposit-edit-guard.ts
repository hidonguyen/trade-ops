// Usage-aware guards for deposit edit and delete.
// All functions accept a Prisma transaction client (tx) so they run atomically
// with the surrounding deposit.update / deposit.delete call.
// Pure helpers — no top-level Prisma client import.

import Decimal from "decimal.js";
import type { PrismaClient } from "@prisma/client";

// Omit transaction-only methods to accept both full client and tx client
type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Error codes emitted by guards so route handlers can map to HTTP status + VN message
export type DepositEditErrorCode =
  | "LOCKED_HAS_USAGES"
  | "AMOUNT_BELOW_USED"
  | "DELETE_BLOCKED_HAS_USAGES";

export class DepositEditError extends Error {
  code: DepositEditErrorCode;
  meta: Record<string, unknown>;

  constructor(code: DepositEditErrorCode, meta: Record<string, unknown> = {}) {
    super(code);
    this.name = "DepositEditError";
    this.code = code;
    this.meta = meta;
  }
}

export interface DepositUsageStats {
  usedAmount: Decimal;      // Σ positive DepositUsage.amountOriginal (deductions)
  creditedAmount: Decimal;  // Σ |negative| DepositUsage.amountOriginal (credits)
  usageCount: number;       // total rows — both signs count; credits still link a refund tx
}

/**
 * Load usage stats for a deposit inside a transaction.
 * Must be called within prisma.$transaction to guarantee consistency with subsequent mutations.
 */
export async function loadDepositUsageStats(
  tx: TxClient,
  depositId: string
): Promise<DepositUsageStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usages = await (tx as any).depositUsage.findMany({
    where: { depositId },
    select: { amountOriginal: true },
  });

  let usedAmount = new Decimal(0);
  let creditedAmount = new Decimal(0);

  for (const u of usages) {
    const amt = new Decimal(u.amountOriginal.toString());
    if (amt.greaterThan(0)) {
      usedAmount = usedAmount.plus(amt);
    } else {
      // negative entries are credits (REFUND+DEPOSIT auto-create)
      creditedAmount = creditedAmount.plus(amt.abs());
    }
  }

  return { usedAmount, creditedAmount, usageCount: usages.length };
}

/**
 * Reject currency / businessUnit changes when the deposit has any DepositUsage rows.
 * Swapping currency would silently break amountVnd already computed for linked transactions.
 */
export function assertCanEditMetadata(stats: DepositUsageStats): void {
  if (stats.usageCount > 0) {
    throw new DepositEditError("LOCKED_HAS_USAGES");
  }
}

/**
 * Reject amount edits that would drop below the already-deducted sum.
 * Allows: newAmount >= usedAmount (remaining stays >= 0 after adjustment).
 */
export function assertNewAmountValid(
  newAmount: string | Decimal,
  stats: DepositUsageStats
): void {
  const proposed = new Decimal(newAmount.toString());
  if (proposed.lessThan(stats.usedAmount)) {
    throw new DepositEditError("AMOUNT_BELOW_USED", {
      used: stats.usedAmount.toFixed(4),
    });
  }
}

/**
 * Reject delete when any DepositUsage row exists (any sign — credits still link a refund tx).
 */
export function assertCanDelete(stats: DepositUsageStats): void {
  if (stats.usageCount > 0) {
    throw new DepositEditError("DELETE_BLOCKED_HAS_USAGES");
  }
}

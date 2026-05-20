// Cache key + tag builders. Centralized so GET handlers and mutation handlers stay consistent.
// Changing a tag name here automatically updates both read and invalidation paths.

export const TAG = {
  currencies: "catalog:currencies",
  businessUnits: "catalog:business-units",
  expenseTypes: "catalog:expense-types",
  contacts: "catalog:contacts",
  parties: "catalog:parties",
  reportSummary: "reports:summary",
  reportDashboard: "reports:dashboard",
  reportBankFees: "reports:bank-fees",
  reportExpenseType: "reports:expense-type",
  reportCashflow: "reports:cashflow",
  reportsByBu: (buId: string) => `reports:bu:${buId}`,
  // Per-entity tags (extended coverage)
  users: "catalog:users",
  user: (id: string) => `user:${id}`,
  order: (id: string) => `order:${id}`,
  party: (id: string) => `party:${id}`,
  partyDeposits: (partyId: string) => `party:${partyId}:deposits`,
} as const;

export const TTL = {
  catalog: 10 * 60_000, // 10 minutes
  parties: 5 * 60_000, // 5 minutes (larger list, slightly more dynamic)
  report: 60_000, // 60 seconds — report aggregates
  // Per-entity TTLs
  userList: 5 * 60_000,
  userDetail: 5 * 60_000,
  orderDetail: 30_000,
  orderTxList: 30_000,
  orderReport: 60_000,
  partyDetail: 2 * 60_000,
  partyDeposits: 60_000,
} as const;

// ---- Catalog keys ----

export function currenciesKey() {
  return "catalog:currencies";
}

export function businessUnitsKey() {
  return "catalog:business-units";
}

export function expenseTypesKey() {
  return "catalog:expense-types";
}

export function contactsKey(querySig: string) {
  return `catalog:contacts:${querySig}`;
}

export function partiesKey(type?: string | null) {
  return `catalog:parties:type=${type ?? "all"}`;
}

// ---- Report keys ----

export type ReportKind = "dashboard" | "summary" | "bank-fees" | "expense-type" | "cashflow";

export function reportKey(
  kind: ReportKind,
  parts: { buId: string; from?: string | null; to?: string | null }
) {
  const base = `reports:${kind}:bu=${parts.buId}`;
  return parts.from && parts.to ? `${base}:from=${parts.from}:to=${parts.to}` : base;
}

export function reportTags(kind: ReportKind, buId: string): string[] {
  return [TAG.reportsByBu(buId), `reports:${kind}`];
}

// ---- Per-entity keys ----

export function usersListKey(querySig: string) {
  return `users:list:${querySig}`;
}

export function userKey(id: string) {
  return `user:${id}`;
}

export function orderDetailKey(id: string) {
  return `order:${id}:detail`;
}

export function orderTxListKey(orderId: string, querySig: string) {
  return `order:${orderId}:tx:${querySig}`;
}

export function orderReportKey(orderId: string) {
  return `order:${orderId}:report`;
}

export function partyDetailKey(id: string) {
  return `party:${id}:detail`;
}

export function partyDepositsKey(partyId: string, querySig: string) {
  return `party:${partyId}:deposits:${querySig}`;
}

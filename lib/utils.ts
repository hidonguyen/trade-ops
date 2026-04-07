import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BU_STORAGE_KEY = "trade-ops:selected-bu";

/** Read saved BU ID from localStorage (SSR-safe) */
export function getDefaultBu(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(BU_STORAGE_KEY) ?? "";
}

/** Save selected BU ID to localStorage */
export function saveSelectedBu(id: string): void {
  localStorage.setItem(BU_STORAGE_KEY, id);
}

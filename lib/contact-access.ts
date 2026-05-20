// RBAC helper for Contact (Người Nộp/Nhận) writes.
// Contact is global (no BU). Anyone who can write RECEIPT or PAYMENT in any BU
// may create/update/delete contacts — they're the data those modules consume.
// This includes ADMIN, ACCOUNTANT_CASHFLOW, ACCOUNTANT_SALE (RECEIPT), ACCOUNTANT_PURCHASE (PAYMENT).
import { checkAccessAnyBu, type RoleAssignment } from "@/lib/rbac";
import type { RbacAction } from "@/types";

export function canWriteContact(roles: RoleAssignment[], action: RbacAction): boolean {
  return (
    checkAccessAnyBu(roles, action, "RECEIPT") ||
    checkAccessAnyBu(roles, action, "PAYMENT")
  );
}

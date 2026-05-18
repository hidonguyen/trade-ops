"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";
import { checkAccess, isAdmin as checkIsAdmin, type RoleAssignment } from "@/lib/rbac";
import type { RbacAction, RbacModule } from "@/types";

const RolesCtx = createContext<RoleAssignment[]>([]);

export function RolesProvider({ roles, children }: { roles: RoleAssignment[]; children: ReactNode }) {
  const value = useMemo(() => roles, [roles]);
  return <RolesCtx.Provider value={value}>{children}</RolesCtx.Provider>;
}

export function useRoles(): RoleAssignment[] {
  return useContext(RolesCtx);
}

export function useCan(action: RbacAction, module: RbacModule, businessUnitId: string | null = null): boolean {
  const roles = useRoles();
  return checkAccess(roles, action, module, businessUnitId);
}

export function useIsAdmin(): boolean {
  const roles = useRoles();
  return checkIsAdmin(roles);
}

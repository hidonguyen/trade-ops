"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";
import { checkAccess } from "@/lib/rbac";
import type { RbacAction, RbacModule } from "@/types";

const RolesCtx = createContext<string[]>([]);

export function RolesProvider({ roles, children }: { roles: string[]; children: ReactNode }) {
  const value = useMemo(() => roles, [roles]);
  return <RolesCtx.Provider value={value}>{children}</RolesCtx.Provider>;
}

export function useRoles(): string[] {
  return useContext(RolesCtx);
}

export function useCan(action: RbacAction, module: RbacModule): boolean {
  const roles = useRoles();
  return checkAccess(roles, action, module);
}

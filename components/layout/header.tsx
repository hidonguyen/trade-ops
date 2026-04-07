// Sticky header: mobile hamburger, BU selector, user info, logout
"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { MenuIcon, LogOutIcon, BuildingIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn, getDefaultBu, saveSelectedBu } from "@/lib/utils";

interface BusinessUnit {
  id: string;
  name: string;
  currency?: string;
}

interface HeaderProps {
  userName: string;
  userRoles: string[];
  sidebarContent?: React.ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  ACCOUNTANT_SALE: "KT Bán hàng",
  ACCOUNTANT_PURCHASE: "KT Mua hàng",
  ACCOUNTANT_CASHFLOW: "KT Thu chi",
  VIEWER: "Xem",
};

function RoleBadge({ roles }: { roles: string[] }) {
  const primary = roles[0] ?? "VIEWER";
  return (
    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
      {ROLE_LABELS[primary] ?? primary}
    </span>
  );
}

export function Header({ userName, userRoles, sidebarContent }: HeaderProps) {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [selectedBu, setSelectedBu] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/business-units")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data?.length) {
          setBusinessUnits(json.data);
          // Restore saved BU from localStorage, fallback to first BU
          const saved = getDefaultBu();
          const defaultBu = saved && json.data.find((bu: BusinessUnit) => bu.id === saved)
            ? saved
            : json.data[0].id;
          setSelectedBu(defaultBu);
        }
      })
      .catch(() => {/* non-critical: BU list unavailable */});
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
      {/* Mobile hamburger */}
      <button
        className="lg:hidden rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
        aria-label="Mở menu"
        onClick={() => setMobileOpen(true)}
      >
        <MenuIcon size={20} />
      </button>

      {/* Mobile nav sheet */}
      {sidebarContent && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-60 bg-slate-900 p-0 border-r-0" showCloseButton={false}>
            <SheetHeader className="p-0">
              <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      )}

      {/* BU selector */}
      {businessUnits.length > 0 && (
        <div className="flex items-center gap-1.5">
          <BuildingIcon size={15} className="text-slate-400 shrink-0" />
          <Combobox
            value={selectedBu}
            onValueChange={(val) => {
              if (val) {
                setSelectedBu(val);
                saveSelectedBu(val);
              }
            }}
            options={businessUnits.map((bu) => ({ value: bu.id, label: bu.name }))}
            placeholder="Chọn công ty"
            className={cn(
              "min-w-[140px] border-slate-200 bg-slate-50 text-slate-700",
              "focus-visible:ring-blue-500/30"
            )}
          />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User info + logout */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-sm font-medium text-slate-800">{userName}</span>
          <RoleBadge roles={userRoles} />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Đăng xuất"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-slate-500 hover:text-slate-800"
        >
          <LogOutIcon size={16} />
        </Button>
      </div>
    </header>
  );
}

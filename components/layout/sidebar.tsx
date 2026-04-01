// Dark navy sidebar with nav groups, RBAC filtering, and mobile Sheet support
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ShoppingCartIcon,
  UsersIcon,
  PackageIcon,
  TruckIcon,
  ArrowLeftRightIcon,
  TrendingUpIcon,
  BarChart3Icon,
  SettingsIcon,
  MenuIcon,
  UserCogIcon,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Bán hàng",
    items: [
      { label: "Đơn bán", href: "/orders?type=SALE", icon: ShoppingCartIcon },
      { label: "Khách hàng", href: "/parties?type=CUSTOMER", icon: UsersIcon },
    ],
  },
  {
    title: "Mua hàng",
    items: [
      { label: "Đơn mua", href: "/orders?type=PURCHASE", icon: PackageIcon },
      { label: "Nhà cung cấp", href: "/parties?type=SUPPLIER", icon: TruckIcon },
    ],
  },
  {
    title: "Thu Chi",
    items: [
      { label: "Giao dịch", href: "/transactions", icon: ArrowLeftRightIcon },
      { label: "Dòng tiền", href: "/cashflow", icon: TrendingUpIcon },
    ],
  },
  {
    title: "Báo cáo",
    items: [
      { label: "Tổng hợp", href: "/reports", icon: BarChart3Icon },
    ],
  },
  {
    title: "Cài đặt",
    adminOnly: true,
    items: [
      { label: "Người dùng", href: "/settings/users", icon: UserCogIcon },
      { label: "Cấu hình", href: "/settings", icon: SettingsIcon },
    ],
  },
];

interface SidebarNavProps {
  userRoles: string[];
  pathname: string;
  onNavigate?: () => void;
}

function SidebarNav({ userRoles, pathname, onNavigate }: SidebarNavProps) {
  const isAdmin = userRoles.includes("ADMIN");

  return (
    <nav className="flex flex-col gap-4 px-3 py-4 overflow-y-auto flex-1">
      {NAV_GROUPS.map((group) => {
        if (group.adminOnly && !isAdmin) return null;
        return (
          <div key={group.title}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              {group.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                // Match active by pathname prefix (ignore query string for base path)
                const basePath = item.href.split("?")[0];
                const isActive = pathname === basePath || pathname.startsWith(basePath + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-blue-700 text-white"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon size={18} className="shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

interface SidebarProps {
  userRoles: string[];
}

export function Sidebar({ userRoles }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logo = (
    <div className="flex h-14 items-center px-5 border-b border-slate-700/60 shrink-0">
      <span className="text-lg font-bold tracking-tight text-blue-400">Trade Ops</span>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-slate-900 min-h-screen fixed left-0 top-0 bottom-0 z-30">
        {logo}
        <SidebarNav userRoles={userRoles} pathname={pathname} />
      </aside>

      {/* Mobile hamburger trigger (exported via data attribute for header to pick up) */}
      <button
        className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100"
        aria-label="Mở menu"
        onClick={() => setMobileOpen(true)}
        data-mobile-menu-trigger
      >
        <MenuIcon size={20} />
      </button>

      {/* Mobile slide-out sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 bg-slate-900 p-0 border-r-0" showCloseButton={false}>
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
          </SheetHeader>
          {logo}
          <SidebarNav
            userRoles={userRoles}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

// Settings hub — server component with ADMIN role check
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BuildingIcon, CoinsIcon, TagIcon, UsersIcon, ShieldAlertIcon, HistoryIcon } from "lucide-react";

const SETTINGS_CARDS = [
  {
    href: "/settings/business-units",
    icon: BuildingIcon,
    title: "Đơn vị kinh doanh",
    description: "Quản lý các công ty/đơn vị kinh doanh trong hệ thống",
  },
  {
    href: "/settings/currencies",
    icon: CoinsIcon,
    title: "Tiền tệ",
    description: "Quản lý các loại tiền tệ được sử dụng trong giao dịch",
  },
  {
    href: "/settings/expense-types",
    icon: TagIcon,
    title: "Loại chi phí",
    description: "Quản lý danh mục phân loại chi phí",
  },
  {
    href: "/settings/users",
    icon: UsersIcon,
    title: "Người dùng",
    description: "Quản lý tài khoản và phân quyền người dùng",
  },
  {
    href: "/settings/audit-logs",
    icon: HistoryIcon,
    title: "Nhật ký hệ thống",
    description: "Lịch sử thay đổi dữ liệu trong hệ thống",
  },
];

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userIsAdmin = isAdmin(session.user.roles ?? []);

  if (!userIsAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlertIcon className="size-16 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-600">Không có quyền truy cập</h2>
        <p className="text-sm text-slate-400">Chỉ quản trị viên mới có thể truy cập trang này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cài đặt hệ thống</h1>
        <p className="mt-1 text-sm text-slate-500">Quản lý cấu hình và danh mục dữ liệu</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_CARDS.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-shadow hover:shadow-md cursor-pointer border-slate-200">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <Icon className="size-5 text-slate-600" />
                </div>
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription className="text-sm leading-snug">{description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

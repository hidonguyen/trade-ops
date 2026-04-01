// User list — ADMIN only, DataTable with role badges, link to create/edit
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, ShieldAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/shared/data-table";

interface UserRole { role: string; }
interface UserRow extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roles: UserRole[];
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  ACCOUNTANT_SALE: "KT Bán hàng",
  ACCOUNTANT_PURCHASE: "KT Mua hàng",
  ACCOUNTANT_CASHFLOW: "KT Dòng tiền",
  VIEWER: "Xem",
};

const COLUMNS: Column<UserRow>[] = [
  { key: "name", label: "Họ tên", sortable: true },
  { key: "email", label: "Email", sortable: true },
  {
    key: "roles",
    label: "Vai trò",
    render: (val: UserRole[]) => (
      <div className="flex flex-wrap gap-1">
        {(val ?? []).map((r) => (
          <Badge key={r.role} variant="secondary" className="text-xs">
            {ROLE_LABELS[r.role] ?? r.role}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    key: "isActive",
    label: "Trạng thái",
    align: "center",
    render: (val) => (
      <Badge variant={val ? "default" : "outline"} className="text-xs">
        {val ? "Hoạt động" : "Vô hiệu"}
      </Badge>
    ),
  },
];

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.status === 403) { setIsAdmin(false); return; }
      const json = await res.json();
      if (json.success) {
        setIsAdmin(true);
        setUsers(json.data);
      } else {
        setError(json.message ?? "Lỗi tải dữ liệu");
      }
    } catch {
      setError("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlertIcon className="size-16 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-600">Không có quyền truy cập</h2>
        <p className="text-sm text-slate-400">Chỉ quản trị viên mới có thể truy cập trang này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Người dùng</h1>
          <p className="mt-0.5 text-sm text-slate-500">Quản lý tài khoản và phân quyền</p>
        </div>
        <Button onClick={() => router.push("/settings/users/new")}>
          <PlusIcon className="size-4 mr-1.5" />
          Thêm người dùng
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
      )}

      <DataTable<UserRow>
        columns={COLUMNS}
        data={users}
        loading={loading}
        emptyMessage="Chưa có người dùng nào"
        onRowClick={(row) => router.push(`/settings/users/${row.id}`)}
        rowKey={(r) => r.id}
      />
    </div>
  );
}

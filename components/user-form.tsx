// User create/edit form — fields: name, email, password, isActive, roles
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ALL_ROLES = [
  { value: "ADMIN", label: "Quản trị viên" },
  { value: "ACCOUNTANT_SALE", label: "Kế toán bán hàng" },
  { value: "ACCOUNTANT_PURCHASE", label: "Kế toán mua hàng" },
  { value: "ACCOUNTANT_CASHFLOW", label: "Kế toán dòng tiền" },
  { value: "VIEWER", label: "Xem" },
] as const;

type RoleValue = (typeof ALL_ROLES)[number]["value"];

export interface UserFormData {
  name: string;
  email: string;
  password?: string;
  isActive: boolean;
  roles: RoleValue[];
}

interface UserFormProps {
  initialData?: Partial<UserFormData>;
  onSubmit: (data: UserFormData) => Promise<void>;
  mode: "create" | "edit";
  submitting?: boolean;
  error?: string | null;
}

export function UserForm({ initialData, onSubmit, mode, submitting, error }: UserFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [password, setPassword] = useState("");
  const [changePassword, setChangePassword] = useState(false);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [roles, setRoles] = useState<RoleValue[]>(initialData?.roles ?? []);
  const [validationError, setValidationError] = useState<string | null>(null);

  function toggleRole(role: RoleValue) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) { setValidationError("Tên không được để trống"); return; }
    if (!email.trim()) { setValidationError("Email không được để trống"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setValidationError("Email không hợp lệ"); return; }
    if (mode === "create" && !password) { setValidationError("Mật khẩu là bắt buộc"); return; }
    if ((mode === "create" || changePassword) && password && password.length < 8) {
      setValidationError("Mật khẩu tối thiểu 8 ký tự");
      return;
    }
    if (roles.length === 0) { setValidationError("Phải chọn ít nhất một vai trò"); return; }

    const payload: UserFormData = { name: name.trim(), email: email.trim(), isActive, roles };
    if (mode === "create" || changePassword) payload.password = password;

    await onSubmit(payload);
  }

  const displayError = validationError ?? error;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {displayError && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{displayError}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Họ và tên <span className="text-red-500">*</span></Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" disabled={mode === "edit"} />
        </div>
      </div>

      {/* Password field */}
      {mode === "create" ? (
        <div className="space-y-1.5">
          <Label htmlFor="password">Mật khẩu <span className="text-red-500">*</span></Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự" />
        </div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={changePassword} onChange={(e) => setChangePassword(e.target.checked)} className="rounded" />
            Đổi mật khẩu
          </label>
          {changePassword && (
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu mới (tối thiểu 8 ký tự)" />
          )}
        </div>
      )}

      {/* Active toggle */}
      <div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded"
          />
          Tài khoản đang hoạt động
        </label>
      </div>

      {/* Roles */}
      <div className="space-y-2">
        <Label>Vai trò <span className="text-red-500">*</span></Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ALL_ROLES.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={roles.includes(r.value)}
                onChange={() => toggleRole(r.value)}
                className="rounded"
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Đang lưu..." : mode === "create" ? "Tạo người dùng" : "Lưu thay đổi"}
      </Button>
    </form>
  );
}

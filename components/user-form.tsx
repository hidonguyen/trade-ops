// User create/edit form — name, email, password, isActive, one role + BU scope.
// A user holds a single role applied across every Business Unit it is granted.
// ADMIN is global (no BU selection).
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface UserFormData {
  name: string;
  email: string;
  password?: string;
  isActive: boolean;
  role: string;
  // Empty when role is ADMIN (global). Otherwise the BUs the role applies to.
  businessUnitIds: string[];
}

interface UserFormProps {
  initialData?: Partial<UserFormData>;
  onSubmit: (data: UserFormData) => Promise<void>;
  mode: "create" | "edit";
  submitting?: boolean;
  error?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "ADMIN", label: "Quản trị viên (Admin) — toàn hệ thống" },
  { value: "ACCOUNTANT_SALE", label: "KT Bán hàng" },
  { value: "ACCOUNTANT_PURCHASE", label: "KT Mua hàng" },
  { value: "ACCOUNTANT_CASHFLOW", label: "KT Thu chi" },
  { value: "VIEWER", label: "Xem" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function UserForm({ initialData, onSubmit, mode, submitting, error }: UserFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [password, setPassword] = useState("");
  const [changePassword, setChangePassword] = useState(false);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [role, setRole] = useState<string>(initialData?.role ?? "VIEWER");
  const [selectedBuIds, setSelectedBuIds] = useState<Set<string>>(
    () => new Set(initialData?.businessUnitIds ?? [])
  );

  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [buLoading, setBuLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business-units")
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) {
          setBusinessUnits((json.data as BusinessUnit[]).filter((bu) => bu.isActive));
        }
      })
      .catch(console.error)
      .finally(() => setBuLoading(false));
  }, []);

  const isAdminRole = role === "ADMIN";

  function toggleBu(buId: string) {
    setSelectedBuIds((prev) => {
      const next = new Set(prev);
      if (next.has(buId)) next.delete(buId); else next.add(buId);
      return next;
    });
  }

  function toggleAllBus() {
    setSelectedBuIds((prev) =>
      prev.size === businessUnits.length ? new Set() : new Set(businessUnits.map((b) => b.id))
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
      setValidationError("Mật khẩu tối thiểu 8 ký tự"); return;
    }

    const businessUnitIds = isAdminRole ? [] : [...selectedBuIds];
    if (!isAdminRole && businessUnitIds.length === 0) {
      setValidationError("Phải chọn ít nhất một đơn vị kinh doanh"); return;
    }

    const payload: UserFormData = {
      name: name.trim(),
      email: email.trim(),
      isActive,
      role,
      businessUnitIds,
    };
    if (mode === "create" || changePassword) payload.password = password;

    await onSubmit(payload);
  }

  const displayError = validationError ?? error;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {displayError && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{displayError}</p>
      )}

      {/* Name + Email */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Họ và tên <span className="text-red-500">*</span></Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
          <Input
            id="email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            disabled={mode === "edit"}
          />
        </div>
      </div>

      {/* Password */}
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
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
          Tài khoản đang hoạt động
        </label>
      </div>

      {/* Role selector */}
      <div className="space-y-2">
        <Label>Vai trò <span className="text-red-500">*</span></Label>
        <div className="space-y-1.5">
          {ROLE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="role"
                value={opt.value}
                checked={role === opt.value}
                onChange={() => setRole(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Business Unit scope — hidden for ADMIN (global) */}
      {!isAdminRole && (
        <div className="space-y-2">
          <Label>Đơn vị kinh doanh được phân quyền <span className="text-red-500">*</span></Label>
          <div className="rounded-lg border border-slate-200">
            {buLoading ? (
              <p className="px-4 py-3 text-sm text-slate-500">Đang tải đơn vị kinh doanh...</p>
            ) : businessUnits.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">Không có đơn vị kinh doanh nào.</p>
            ) : (
              <>
                <label className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBuIds.size === businessUnits.length}
                    onChange={toggleAllBus}
                    className="rounded"
                  />
                  Chọn tất cả
                </label>
                {businessUnits.map((bu) => (
                  <label key={bu.id} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedBuIds.has(bu.id)}
                      onChange={() => toggleBu(bu.id)}
                      className="rounded"
                    />
                    {bu.name}{bu.code ? ` (${bu.code})` : ""}
                  </label>
                ))}
              </>
            )}
          </div>
          <p className="text-xs text-slate-400">Vai trò trên áp dụng cho mọi đơn vị được chọn.</p>
        </div>
      )}

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Đang lưu..." : mode === "create" ? "Tạo người dùng" : "Lưu thay đổi"}
      </Button>
    </form>
  );
}

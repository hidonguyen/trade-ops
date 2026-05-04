// Shared create/edit form for Party (Customer / Supplier)
"use client";

import { useState, useEffect } from "react";
import { getDefaultBu } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";

export interface PartyFormData {
  name: string;
  type: "CUSTOMER" | "SUPPLIER";
  businessUnitId: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
}

interface PartyFormProps {
  initialData?: Partial<PartyFormData>;
  onSubmit: (data: PartyFormData) => Promise<void>;
  mode: "create" | "edit";
}

const EMPTY: PartyFormData = {
  name: "", type: "CUSTOMER", businessUnitId: "",
  address: "", phone: "", email: "", taxId: "",
};

const TYPE_OPTIONS = [
  { value: "CUSTOMER", label: "Khách hàng" },
  { value: "SUPPLIER", label: "Nhà cung cấp" },
];

export function PartyForm({ initialData, onSubmit, mode }: PartyFormProps) {
  const [form, setForm] = useState<PartyFormData>(() => ({
    ...EMPTY,
    businessUnitId: getDefaultBu(),
    ...initialData,
  }));
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof PartyFormData, string>>>({});

  // Sync initialData when it becomes available (edit mode)
  useEffect(() => {
    if (initialData) setForm((f) => ({ ...f, ...initialData }));
  }, [initialData]);

  function set<K extends keyof PartyFormData>(key: K, value: PartyFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Tên không được để trống";
    if (!form.businessUnitId) next.businessUnitId = "Vui lòng chọn đơn vị kinh doanh ở thanh tiêu đề";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Email không hợp lệ";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await onSubmit(form);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="pf-name">Tên đối tác <span className="text-red-500">*</span></Label>
        <Input id="pf-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Tên công ty hoặc cá nhân" />
        {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <Label>Loại đối tác <span className="text-red-500">*</span></Label>
        <Combobox
          value={form.type}
          onValueChange={(v) => set("type", v as PartyFormData["type"])}
          options={TYPE_OPTIONS}
          placeholder="Chọn loại"
        />
      </div>

      {/* Phone + Email */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pf-phone">Số điện thoại</Label>
          <Input id="pf-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0901 234 567" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-email">Email</Label>
          <Input id="pf-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="example@company.com" />
          {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
        </div>
      </div>

      {/* Tax ID */}
      <div className="space-y-1.5">
        <Label htmlFor="pf-taxid">Mã số thuế</Label>
        <Input id="pf-taxid" value={form.taxId} onChange={(e) => set("taxId", e.target.value)} placeholder="Mã số thuế (tùy chọn)" />
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <Label htmlFor="pf-address">Địa chỉ</Label>
        <Textarea id="pf-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Địa chỉ đầy đủ" rows={2} />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Đang lưu..." : mode === "create" ? "Tạo đối tác" : "Cập nhật"}
      </Button>
    </form>
  );
}

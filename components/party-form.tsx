// Shared create/edit form for Party (Customer / Supplier / Both)
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BusinessUnit { id: string; code: string; name: string; }

export interface PartyFormData {
  name: string;
  type: "CUSTOMER" | "SUPPLIER" | "BOTH";
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
  { value: "BOTH", label: "Vừa KH vừa NCC" },
];

export function PartyForm({ initialData, onSubmit, mode }: PartyFormProps) {
  const [form, setForm] = useState<PartyFormData>({ ...EMPTY, ...initialData });
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof PartyFormData, string>>>({});

  useEffect(() => {
    fetch("/api/business-units")
      .then((r) => r.json())
      .then((json) => { if (json.success) setBusinessUnits(json.data); })
      .catch(() => {});
  }, []);

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
    if (!form.businessUnitId) next.businessUnitId = "Chọn đơn vị kinh doanh";
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

      {/* Type + Business Unit */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Loại đối tác <span className="text-red-500">*</span></Label>
          <Select value={form.type} onValueChange={(v) => set("type", (v ?? "CUSTOMER") as PartyFormData["type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Đơn vị kinh doanh <span className="text-red-500">*</span></Label>
          <Select value={form.businessUnitId} onValueChange={(v) => set("businessUnitId", v ?? "")}>
            <SelectTrigger><SelectValue placeholder="Chọn đơn vị" /></SelectTrigger>
            <SelectContent>
              {businessUnits.map((bu) => (
                <SelectItem key={bu.id} value={bu.id}>{bu.code} — {bu.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.businessUnitId && <p className="text-xs text-red-500">{errors.businessUnitId}</p>}
        </div>
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

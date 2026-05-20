// Inline create dialog for Người Nộp/Nhận — opened from receipt/payment forms
// when the searcher can't find an existing contact. Posts to /api/contacts
// and bubbles the created record back so the caller can auto-select it.
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export interface QuickContact {
  id: string;
  name: string;
  phone?: string | null;
}

interface Props {
  open: boolean;
  initialName?: string;
  // When provided, the new contact is linked to this BU only. Omit → server
  // backfills with every active BU ("Chung tất cả BU").
  businessUnitId?: string;
  onClose: () => void;
  onCreated: (contact: QuickContact) => void;
}

export function ContactQuickCreateDialog({ open, initialName, businessUnitId, onClose, onCreated }: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state each time the dialog reopens so it never carries stale data.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setPhone("");
      setTaxId("");
      setError(null);
      onClose();
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError("Tên không được để trống"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { name: name.trim(), phone, taxId };
      if (businessUnitId) payload.businessUnitIds = [businessUnitId];
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Lỗi tạo người nộp/nhận");
        return;
      }
      onCreated(json.data as QuickContact);
      handleOpenChange(false);
    } catch {
      setError("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm người nộp/nhận</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="qc-name">Tên *</Label>
            <Input id="qc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Họ và tên" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-phone">Số điện thoại</Label>
            <Input id="qc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="VD: 0912345678" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-tax">MST cá nhân</Label>
            <Input id="qc-tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="MST (tùy chọn)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

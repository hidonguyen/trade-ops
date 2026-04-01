// Deposit creation dialog — POST /api/parties/[id]/deposits
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Currency { id: string; code: string; symbol: string; }
interface BusinessUnit { id: string; code: string; name: string; }

interface DepositFormProps {
  partyId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function DepositForm({ partyId, open, onClose, onCreated }: DepositFormProps) {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [currencyId, setCurrencyId] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [amountOriginal, setAmountOriginal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/currencies").then((r) => r.json()),
      fetch("/api/business-units").then((r) => r.json()),
    ]).then(([cur, bu]) => {
      if (cur.success) setCurrencies(cur.data);
      if (bu.success) setBusinessUnits(bu.data);
    }).catch(() => {});
  }, [open]);

  function reset() {
    setCurrencyId("");
    setBusinessUnitId("");
    setAmountOriginal("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!currencyId || !businessUnitId || !amountOriginal) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }
    const amount = parseFloat(amountOriginal);
    if (isNaN(amount) || amount <= 0) {
      setError("Số tiền phải là số dương");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/parties/${partyId}/deposits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currencyId, businessUnitId, amountOriginal: String(amount) }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.message ?? "Lỗi không xác định"); return; }
      reset();
      onCreated();
    } catch {
      setError("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm tiền đặt cọc</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="space-y-1.5">
            <Label>Tiền tệ <span className="text-red-500">*</span></Label>
            <Select value={currencyId} onValueChange={(v) => setCurrencyId(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Chọn tiền tệ" /></SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.symbol} {c.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Đơn vị kinh doanh <span className="text-red-500">*</span></Label>
            <Select value={businessUnitId} onValueChange={(v) => setBusinessUnitId(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Chọn đơn vị" /></SelectTrigger>
              <SelectContent>
                {businessUnits.map((bu) => (
                  <SelectItem key={bu.id} value={bu.id}>{bu.code} — {bu.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dep-amount">Số tiền <span className="text-red-500">*</span></Label>
            <Input
              id="dep-amount"
              type="number"
              min="0"
              step="any"
              value={amountOriginal}
              onChange={(e) => setAmountOriginal(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Đang lưu..." : "Thêm cọc"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

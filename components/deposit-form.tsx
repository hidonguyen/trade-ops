// Deposit creation dialog — POST /api/parties/[id]/deposits
"use client";

import { useState, useEffect } from "react";
import { getDefaultBu } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { NumberInput } from "@/components/ui/number-input";

interface Currency { id: string; code: string; symbol: string; }

interface DepositFormProps {
  partyId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function DepositForm({ partyId, open, onClose, onCreated }: DepositFormProps) {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyId, setCurrencyId] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState(getDefaultBu);
  const [amountOriginal, setAmountOriginal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/currencies")
      .then((r) => r.json())
      .then((json) => { if (json.success) setCurrencies(json.data); })
      .catch(() => {});
  }, [open]);

  function reset() {
    setCurrencyId("");
    setBusinessUnitId(getDefaultBu());
    setAmountOriginal("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!businessUnitId) {
      setError("Vui lòng chọn đơn vị kinh doanh ở thanh tiêu đề");
      return;
    }
    if (!currencyId || !amountOriginal) {
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
            <Combobox
              value={currencyId}
              onValueChange={setCurrencyId}
              options={currencies.map((c) => ({ value: c.id, label: `${c.symbol} ${c.code}` }))}
              placeholder="Chọn tiền tệ"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Số tiền <span className="text-red-500">*</span></Label>
            <NumberInput
              value={amountOriginal}
              onChange={setAmountOriginal}
              decimals={2}
              min={0}
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

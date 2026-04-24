// Edit dialog for an existing deposit — PATCH /api/parties/[id]/deposits/[depositId]
// Currency/BU selectors are disabled when usageCount > 0 (usage-locked fields)
"use client";

import { useState, useEffect } from "react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { NumberInput } from "@/components/ui/number-input";

// Format amount for hint display (e.g. "1,000.0000 USD")
function fmtAmt(amount: string, code: string) {
  const n = parseFloat(amount);
  return isNaN(n) ? `${amount} ${code}` : `${n.toLocaleString("vi-VN", { maximumFractionDigits: 4 })} ${code}`;
}

interface Currency { id: string; code: string; symbol: string; }
interface BusinessUnit { id: string; code: string; name: string; }

export interface EnrichedDeposit {
  id: string;
  amountOriginal: string;
  remainingOriginal: string;
  usedAmount: string;
  creditedAmount: string;
  usageCount: number;
  currency: Currency;
  businessUnit: BusinessUnit;
}

interface DepositEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  partyId: string;
  deposit: EnrichedDeposit | null;
}

export function DepositEditDialog({
  open,
  onClose,
  onSuccess,
  partyId,
  deposit,
}: DepositEditDialogProps) {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [amountOriginal, setAmountOriginal] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  // Prefill form from deposit prop whenever dialog opens
  useEffect(() => {
    if (!open || !deposit) return;
    setAmountOriginal(deposit.amountOriginal);
    setCurrencyId(deposit.currency.id);
    setBusinessUnitId(deposit.businessUnit.id);
    setError(null);
    setAmountError(null);
  }, [open, deposit]);

  // Fetch lookup data when dialog opens
  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/currencies").then((r) => r.json()),
      fetch("/api/business-units").then((r) => r.json()),
    ])
      .then(([currJson, buJson]) => {
        if (currJson.success) setCurrencies(currJson.data);
        if (buJson.success) setBusinessUnits(buJson.data);
      })
      .catch(() => {});
  }, [open]);

  function handleClose() {
    setError(null);
    setAmountError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!deposit) return;
    setError(null);
    setAmountError(null);

    // Client-side: amount must be >= usedAmount
    const newAmount = parseFloat(amountOriginal);
    if (isNaN(newAmount) || newAmount <= 0) {
      setAmountError("Số tiền phải là số dương");
      return;
    }
    const usedDec = new Decimal(deposit.usedAmount || "0");
    if (new Decimal(newAmount).lessThan(usedDec)) {
      setAmountError(
        `Số tiền phải ≥ ${usedDec.toFixed(4)} (đã sử dụng)`
      );
      return;
    }

    // Build patch body — only send changed fields
    const body: Record<string, string> = {};
    if (amountOriginal !== deposit.amountOriginal) body.amountOriginal = String(newAmount);
    if (currencyId !== deposit.currency.id) body.currencyId = currencyId;
    if (businessUnitId !== deposit.businessUnit.id) body.businessUnitId = businessUnitId;

    if (Object.keys(body).length === 0) {
      handleClose();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/parties/${partyId}/deposits/${deposit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        // Map field-level error or top-level message
        const fieldErr = json.errors?.amountOriginal?.[0];
        if (fieldErr) {
          setAmountError(fieldErr);
        } else {
          setError(json.message ?? "Lỗi không xác định");
        }
        return;
      }
      onSuccess();
      handleClose();
    } catch {
      setError("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  }

  if (!deposit) return null;

  const locked = deposit.usageCount > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa tiền đặt cọc</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Usage hint box */}
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 space-y-0.5">
            <p>
              Đã sử dụng:{" "}
              <span className="font-semibold">{fmtAmt(deposit.usedAmount, deposit.currency.code)}</span>
              {" "}— số tiền mới phải ≥ giá trị này.
            </p>
            <p className="text-amber-700">
              Còn lại:{" "}
              <span className="font-medium">{fmtAmt(deposit.remainingOriginal, deposit.currency.code)}</span>
            </p>
          </div>

          {/* Amount field */}
          <div className="space-y-1.5">
            <Label>Số tiền <span className="text-red-500">*</span></Label>
            <NumberInput
              value={amountOriginal}
              onChange={(v) => { setAmountOriginal(v); setAmountError(null); }}
              decimals={4}
              min={0}
              placeholder="0.0000"
            />
            {amountError && <p className="text-xs text-red-500">{amountError}</p>}
          </div>

          {/* Currency selector — disabled when locked */}
          <div className="space-y-1.5">
            <Label>Tiền tệ <span className="text-red-500">*</span></Label>
            <Combobox
              value={currencyId}
              onValueChange={setCurrencyId}
              options={currencies.map((c) => ({ value: c.id, label: `${c.symbol} ${c.code}` }))}
              placeholder="Chọn tiền tệ"
              disabled={locked}
            />
            {locked && (
              <p className="text-xs text-slate-500">Không thể thay đổi — cọc đã có giao dịch</p>
            )}
          </div>

          {/* Business unit selector — disabled when locked */}
          <div className="space-y-1.5">
            <Label>Đơn vị kinh doanh</Label>
            <Combobox
              value={businessUnitId}
              onValueChange={setBusinessUnitId}
              options={businessUnits.map((bu) => ({ value: bu.id, label: `${bu.code} — ${bu.name}` }))}
              placeholder="Chọn đơn vị"
              disabled={locked}
            />
            {locked && (
              <p className="text-xs text-slate-500">Không thể thay đổi — cọc đã có giao dịch</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Payment form for order-linked transactions — supports BANK and DEPOSIT methods
// amountVnd is auto-computed using Decimal.js (no floating-point errors)
"use client";

import { useState, useEffect } from "react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Deposit {
  id: string;
  amountOriginal: string;
  remainingOriginal: string;
  notes: string | null;
}

interface Currency {
  id: string;
  code: string;
  symbol: string;
}

interface PaymentFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orderId: string;
  orderType: string; // "SALE" | "PURCHASE"
  partyId: string;
  currency: Currency;
}

interface FormState {
  paymentType: string;
  paymentMethod: string;
  amountOriginal: string;
  exchangeRate: string;
  amountVnd: string;
  bankReference: string;
  transactionDate: string;
  notes: string;
  depositId: string;
}

const defaultForm: FormState = {
  paymentType: "PAYMENT",
  paymentMethod: "BANK",
  amountOriginal: "",
  exchangeRate: "1",
  amountVnd: "",
  bankReference: "",
  transactionDate: new Date().toISOString().split("T")[0],
  notes: "",
  depositId: "",
};

export function PaymentForm({ open, onClose, onSuccess, orderId, orderType, partyId, currency }: PaymentFormProps) {
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load party deposits when method = DEPOSIT
  useEffect(() => {
    if (form.paymentMethod === "DEPOSIT" && partyId) {
      fetch(`/api/parties/${partyId}/deposits`)
        .then((r) => r.json())
        .then((json) => { if (json.success) setDeposits(json.data); })
        .catch(() => setError("Không thể tải danh sách cọc"));
    }
  }, [form.paymentMethod, partyId]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm({ ...defaultForm });
      setError(null);
    }
  }, [open]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      // Recompute amountVnd whenever amounts or rate change
      if (key === "amountOriginal" || key === "exchangeRate") {
        try {
          const amt = new Decimal(updated.amountOriginal || "0");
          const rate = new Decimal(updated.exchangeRate || "1");
          updated.amountVnd = amt.times(rate).toDecimalPlaces(4).toString();
        } catch {
          updated.amountVnd = "";
        }
      }
      return updated;
    });
  }

  function validate(): string | null {
    if (!form.paymentType) return "Loại thanh toán là bắt buộc";
    if (!form.paymentMethod) return "Phương thức thanh toán là bắt buộc";
    if (!form.amountOriginal || isNaN(parseFloat(form.amountOriginal)) || parseFloat(form.amountOriginal) <= 0)
      return "Số tiền phải lớn hơn 0";
    if (!form.exchangeRate || isNaN(parseFloat(form.exchangeRate)) || parseFloat(form.exchangeRate) <= 0)
      return "Tỷ giá không hợp lệ";
    if (!form.transactionDate) return "Ngày giao dịch là bắt buộc";
    if (form.paymentMethod === "DEPOSIT" && !form.depositId) return "Vui lòng chọn cọc";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    setError(null);

    const payload = {
      type: orderType === "SALE" ? "SALE_PAYMENT" : "PURCHASE_PAYMENT",
      paymentType: form.paymentType,
      paymentMethod: form.paymentMethod,
      amountOriginal: form.amountOriginal,
      exchangeRate: form.exchangeRate,
      amountVnd: form.amountVnd,
      currencyId: currency.id,
      bankReference: form.bankReference || null,
      transactionDate: form.transactionDate,
      notes: form.notes || null,
      ...(form.paymentMethod === "DEPOSIT" && form.depositId ? { depositId: form.depositId } : {}),
    };

    try {
      const res = await fetch(`/api/orders/${orderId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Lỗi tạo thanh toán");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm thanh toán</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loại thanh toán</Label>
              <Select value={form.paymentType} onValueChange={(v) => setField("paymentType", v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAYMENT">Thanh toán</SelectItem>
                  <SelectItem value="REFUND">Hoàn tiền</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Phương thức</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(v) => { setField("paymentMethod", v ?? ""); setField("depositId", ""); }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK">Ngân hàng</SelectItem>
                  <SelectItem value="DEPOSIT">Cọc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.paymentMethod === "DEPOSIT" && (
            <div className="space-y-1.5">
              <Label>Chọn cọc</Label>
              <Select value={form.depositId} onValueChange={(v) => setField("depositId", v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Chọn cọc..." /></SelectTrigger>
                <SelectContent>
                  {deposits.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      Còn lại: {d.remainingOriginal} {currency.code}
                      {d.notes ? ` — ${d.notes}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Số tiền ({currency.code})</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.0000"
                value={form.amountOriginal}
                onChange={(e) => setField("amountOriginal", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tiền tệ</Label>
              <Input value={`${currency.symbol} ${currency.code}`} readOnly className="bg-slate-50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tỷ giá</Label>
              <Input
                type="number"
                step="0.00000001"
                min="0"
                value={form.exchangeRate}
                onChange={(e) => setField("exchangeRate", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Thành tiền VND</Label>
              <Input value={form.amountVnd} readOnly className="bg-slate-50 font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mã tham chiếu</Label>
              <Input
                placeholder="Số chứng từ..."
                value={form.bankReference}
                onChange={(e) => setField("bankReference", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Ngày giao dịch</Label>
              <Input
                type="date"
                value={form.transactionDate}
                onChange={(e) => setField("transactionDate", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Textarea
              placeholder="Ghi chú..."
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : "Lưu thanh toán"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

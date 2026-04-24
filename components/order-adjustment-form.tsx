// Adjustment dialog for order value corrections (ORDER_ADJUSTMENT transactions)
// Separated from payment-form.tsx to keep both files under 200 LOC
// Sends: type="ORDER_ADJUSTMENT", paymentType="ADJUSTMENT", paymentMethod="BANK"
"use client";

import { useState, useEffect } from "react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Currency {
  id: string;
  code: string;
  symbol: string;
}

interface FormState {
  amountOriginal: string;
  exchangeRate: string;
  amountVnd: string;
  transactionDate: string;
  notes: string;
}

const defaultForm: FormState = {
  amountOriginal: "",
  exchangeRate: "1",
  amountVnd: "",
  transactionDate: new Date().toISOString().split("T")[0],
  notes: "",
};

export interface EditingAdjustment {
  id: string;
  amountOriginal: string;
  exchangeRate: string;
  amountVnd: string;
  transactionDate: string;
  notes: string | null;
}

interface OrderAdjustmentFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orderId: string;
  orderType: string; // "SALE" | "PURCHASE"
  currency: Currency;
  editingTransaction?: EditingAdjustment | null;
}

export function OrderAdjustmentForm({
  open, onClose, onSuccess, orderId, orderType, currency, editingTransaction,
}: OrderAdjustmentFormProps) {
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!editingTransaction;

  // Reset form on open — prefill when editing
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingTransaction) {
      setForm({
        amountOriginal: editingTransaction.amountOriginal,
        exchangeRate: editingTransaction.exchangeRate,
        amountVnd: editingTransaction.amountVnd,
        transactionDate: editingTransaction.transactionDate.split("T")[0],
        notes: editingTransaction.notes ?? "",
      });
    } else {
      setForm({ ...defaultForm });
    }
  }, [open, editingTransaction]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      // Recompute amountVnd when amount or rate changes
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
    const amt = parseFloat(form.amountOriginal);
    if (!form.amountOriginal || isNaN(amt) || amt === 0)
      return "Số tiền điều chỉnh phải khác 0";
    if (!form.exchangeRate || isNaN(parseFloat(form.exchangeRate)) || parseFloat(form.exchangeRate) <= 0)
      return "Tỷ giá không hợp lệ";
    if (!form.transactionDate) return "Ngày giao dịch là bắt buộc";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    setError(null);

    try {
      let res: Response;
      if (isEditing && editingTransaction) {
        // PATCH: send only mutable fields (schema allows signed amountOriginal)
        res = await fetch(`/api/orders/${orderId}/transactions/${editingTransaction.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountOriginal: form.amountOriginal,
            exchangeRate: form.exchangeRate,
            amountVnd: form.amountVnd || "0",
            transactionDate: form.transactionDate,
            notes: form.notes || null,
          }),
        });
      } else {
        const payload = {
          type: "ORDER_ADJUSTMENT",
          paymentType: "ADJUSTMENT",
          paymentMethod: "BANK",
          amountOriginal: form.amountOriginal,
          exchangeRate: form.exchangeRate,
          amountVnd: form.amountVnd || "0",
          currencyId: currency.id,
          transactionDate: form.transactionDate,
          notes: form.notes || null,
        };
        res = await fetch(`/api/orders/${orderId}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? (isEditing ? "Lỗi cập nhật điều chỉnh" : "Lỗi tạo điều chỉnh"));
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Chỉnh sửa điều chỉnh giá trị đơn hàng" : "Thêm điều chỉnh giá trị đơn hàng"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            Nhập số âm để giảm giá trị đơn hàng, số dương để tăng.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Số tiền điều chỉnh ({currency.code}) <span className="text-red-500">*</span></Label>
              <NumberInput
                value={form.amountOriginal}
                onChange={(v) => setField("amountOriginal", v)}
                decimals={4}
                placeholder="VD: -500000 hoặc 200000"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tỷ giá <span className="text-red-500">*</span></Label>
              <NumberInput
                value={form.exchangeRate}
                onChange={(v) => setField("exchangeRate", v)}
                decimals={8}
                min={0}
                placeholder="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Thành tiền VND</Label>
              <NumberInput value={form.amountVnd} onChange={() => {}} readOnly decimals={4} />
            </div>

            <div className="space-y-1.5">
              <Label>Ngày điều chỉnh <span className="text-red-500">*</span></Label>
              <DatePicker
                value={form.transactionDate}
                onChange={(v) => setField("transactionDate", v)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ghi chú / Lý do điều chỉnh</Label>
            <Textarea
              placeholder="Lý do điều chỉnh..."
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : isEditing ? "Cập nhật" : "Lưu điều chỉnh"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

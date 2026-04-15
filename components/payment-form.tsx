// Payment form for order-linked transactions — supports BANK and DEPOSIT methods
// amountVnd is auto-computed using Decimal.js (no floating-point errors)
"use client";

import { useState, useEffect } from "react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Sentinel value used in the deposit combobox to signal "auto-create a new deposit"
// on REFUND + DEPOSIT. Client strips it before POST; backend auto-creates.
const DEPOSIT_CREATE_NEW = "__CREATE_NEW__";

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
  // Bank fee borne by company (only when paymentMethod = BANK)
  bankFeeOriginal: string;
  bankFeeVnd: string;
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
  bankFeeOriginal: "",
  bankFeeVnd: "",
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

  // Auto-select "create new" when REFUND + DEPOSIT and party has no deposits
  useEffect(() => {
    if (
      form.paymentMethod === "DEPOSIT" &&
      form.paymentType === "REFUND" &&
      deposits.length === 0 &&
      !form.depositId
    ) {
      setForm((prev) => ({ ...prev, depositId: DEPOSIT_CREATE_NEW }));
    }
  }, [form.paymentMethod, form.paymentType, deposits.length, form.depositId]);

  // Reset form and stale deposits when dialog opens
  useEffect(() => {
    if (open) {
      setForm({ ...defaultForm });
      setDeposits([]);
      setError(null);
    }
  }, [open]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      // Reset the "create new" sentinel if user switches to PAYMENT (not valid there)
      if (key === "paymentType" && value === "PAYMENT" && prev.depositId === DEPOSIT_CREATE_NEW) {
        updated.depositId = "";
      }
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
      // Recompute bankFeeVnd when fee or rate changes
      if (key === "bankFeeOriginal" || key === "exchangeRate") {
        if (!updated.bankFeeOriginal) {
          updated.bankFeeVnd = "";
        } else {
          try {
            const fee = new Decimal(updated.bankFeeOriginal || "0");
            const rate = new Decimal(updated.exchangeRate || "1");
            updated.bankFeeVnd = fee.times(rate).toDecimalPlaces(4).toString();
          } catch {
            updated.bankFeeVnd = "";
          }
        }
      }
      // Clear fee when switching away from BANK
      if (key === "paymentMethod" && value !== "BANK") {
        updated.bankFeeOriginal = "";
        updated.bankFeeVnd = "";
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
    if (form.paymentMethod === "DEPOSIT") {
      if (!form.depositId) return "Vui lòng chọn cọc";
      if (form.paymentType === "PAYMENT" && form.depositId === DEPOSIT_CREATE_NEW) {
        return "Thanh toán phải dùng cọc hiện có, không thể tạo mới";
      }
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    setError(null);

    const hasBankFee =
      form.paymentMethod === "BANK" &&
      form.bankFeeOriginal &&
      parseFloat(form.bankFeeOriginal) > 0;

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
      // "__CREATE_NEW__" is a UI sentinel — omit depositId so backend auto-creates
      ...(form.paymentMethod === "DEPOSIT" &&
      form.depositId &&
      form.depositId !== DEPOSIT_CREATE_NEW
        ? { depositId: form.depositId }
        : {}),
      ...(hasBankFee
        ? { bankFeeOriginal: form.bankFeeOriginal, bankFeeVnd: form.bankFeeVnd }
        : {}),
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
              <Combobox
                value={form.paymentType}
                onValueChange={(v) => setField("paymentType", v)}
                options={[
                  { value: "PAYMENT", label: "Thanh toán" },
                  { value: "REFUND", label: "Hoàn tiền" },
                ]}
                placeholder="Chọn loại"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Phương thức</Label>
              <Combobox
                value={form.paymentMethod}
                onValueChange={(v) => { setField("paymentMethod", v); setField("depositId", ""); }}
                options={[
                  { value: "BANK", label: "Ngân hàng" },
                  { value: "DEPOSIT", label: "Cọc" },
                ]}
                placeholder="Chọn phương thức"
              />
            </div>
          </div>

          {form.paymentMethod === "DEPOSIT" && (
            <div className="space-y-1.5">
              <Label>Chọn cọc</Label>
              <Combobox
                value={form.depositId}
                onValueChange={(v) => setField("depositId", v)}
                options={[
                  ...deposits.map((d) => ({
                    value: d.id,
                    label: `Còn lại: ${d.remainingOriginal} ${currency.code}${d.notes ? ` — ${d.notes}` : ""}`,
                  })),
                  // For refunds, allow creating a new deposit from the refund amount
                  ...(form.paymentType === "REFUND"
                    ? [{ value: DEPOSIT_CREATE_NEW, label: "+ Tạo cọc mới từ hoàn tiền" }]
                    : []),
                ]}
                placeholder={
                  form.paymentType === "REFUND" && deposits.length === 0
                    ? "Sẽ tạo cọc mới"
                    : "Chọn cọc..."
                }
              />
              {form.depositId === DEPOSIT_CREATE_NEW && (
                <p className="text-xs text-slate-500">
                  Cọc mới sẽ được tạo cho đối tác với số dư = số tiền hoàn
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Số tiền ({currency.code})</Label>
              <NumberInput
                value={form.amountOriginal}
                onChange={(v) => setField("amountOriginal", v)}
                decimals={4}
                min={0}
                placeholder="0.0000"
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
              <NumberInput
                value={form.exchangeRate}
                onChange={(v) => setField("exchangeRate", v)}
                decimals={8}
                min={0}
                placeholder="1"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Thành tiền VND</Label>
              <NumberInput value={form.amountVnd} onChange={() => {}} readOnly decimals={4} />
            </div>
          </div>

          {form.paymentMethod === "BANK" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phí ngân hàng ({currency.code})</Label>
                <NumberInput
                  value={form.bankFeeOriginal}
                  onChange={(v) => setField("bankFeeOriginal", v)}
                  decimals={4}
                  min={0}
                  placeholder="0.0000"
                />
                <p className="text-xs text-slate-500">Phí do công ty chịu, không trừ vào công nợ</p>
              </div>

              <div className="space-y-1.5">
                <Label>Phí VND</Label>
                <NumberInput value={form.bankFeeVnd} onChange={() => {}} readOnly decimals={4} />
              </div>
            </div>
          )}

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
              <DatePicker
                value={form.transactionDate}
                onChange={(v) => setField("transactionDate", v)}
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

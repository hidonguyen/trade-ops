// Payment form for order-linked transactions — supports CREATE and EDIT modes
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

export interface EditingTransaction {
  id: string;
  paymentType: string;
  paymentMethod: string;
  amountOriginal: string;
  exchangeRate: string;
  amountVnd: string;
  bankReference: string | null;
  transactionDate: string;
  notes: string | null;
  bankFeeOriginal: string | null;
  bankFeeVnd: string | null;
}

interface PaymentFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orderId: string;
  orderType: string; // "SALE" | "PURCHASE"
  partyId: string;
  currency: Currency;
  // Edit mode: pre-fill form and call PATCH instead of POST
  editingTransaction?: EditingTransaction | null;
  // Remaining balance for overpayment hint (in original currency)
  maxPaymentAmount?: string;
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

export function PaymentForm({
  open, onClose, onSuccess, orderId, orderType, partyId, currency,
  editingTransaction, maxPaymentAmount,
}: PaymentFormProps) {
  const isEditing = !!editingTransaction;
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load party deposits when method = DEPOSIT — filter by currency to prevent mismatch
  useEffect(() => {
    if (form.paymentMethod === "DEPOSIT" && partyId) {
      fetch(`/api/parties/${partyId}/deposits`)
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            const filtered = json.data.filter((d: any) => d.currencyId === currency.id || d.currency?.id === currency.id);
            setDeposits(filtered);
          }
        })
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

  // Reset/pre-fill form when dialog opens
  useEffect(() => {
    if (!open) return;
    setError(null);
    setDeposits([]);

    if (editingTransaction) {
      // Pre-fill from existing transaction
      setForm({
        paymentType: editingTransaction.paymentType,
        paymentMethod: editingTransaction.paymentMethod,
        amountOriginal: editingTransaction.amountOriginal,
        exchangeRate: editingTransaction.exchangeRate,
        amountVnd: editingTransaction.amountVnd,
        bankReference: editingTransaction.bankReference ?? "",
        transactionDate: editingTransaction.transactionDate.split("T")[0],
        notes: editingTransaction.notes ?? "",
        depositId: "",
        bankFeeOriginal: editingTransaction.bankFeeOriginal ?? "",
        bankFeeVnd: editingTransaction.bankFeeVnd ?? "",
      });
    } else {
      setForm({ ...defaultForm });
    }
  }, [open, editingTransaction]);

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

  // Check if current amount exceeds max (client-side hint only)
  const isOverMax = (() => {
    if (!maxPaymentAmount || form.paymentType !== "PAYMENT") return false;
    try {
      const amt = new Decimal(form.amountOriginal || "0");
      const max = new Decimal(maxPaymentAmount);
      return amt.greaterThan(max);
    } catch {
      return false;
    }
  })();

  function validate(): string | null {
    if (!form.paymentType) return "Loại thanh toán là bắt buộc";
    if (!form.paymentMethod) return "Phương thức thanh toán là bắt buộc";
    if (!form.amountOriginal || isNaN(parseFloat(form.amountOriginal)) || parseFloat(form.amountOriginal) <= 0)
      return "Số tiền phải lớn hơn 0";
    if (!form.exchangeRate || isNaN(parseFloat(form.exchangeRate)) || parseFloat(form.exchangeRate) <= 0)
      return "Tỷ giá không hợp lệ";
    if (!form.bankReference?.trim()) return "Mã tham chiếu là bắt buộc";
    if (!form.transactionDate) return "Ngày giao dịch là bắt buộc";
    if (form.paymentMethod === "DEPOSIT" && !isEditing) {
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

    try {
      let res: Response;

      if (isEditing) {
        // PATCH — only send changed fields
        const patchPayload: Record<string, unknown> = {
          amountOriginal: form.amountOriginal,
          amountVnd: form.amountVnd,
          exchangeRate: form.exchangeRate,
          bankReference: form.bankReference || null,
          transactionDate: form.transactionDate,
          notes: form.notes || null,
        };
        res = await fetch(`/api/orders/${orderId}/transactions/${editingTransaction!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload),
        });
      } else {
        // POST — full payload for create
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
          ...(form.paymentMethod === "DEPOSIT" &&
          form.depositId &&
          form.depositId !== DEPOSIT_CREATE_NEW
            ? { depositId: form.depositId }
            : {}),
          ...(hasBankFee
            ? { bankFeeOriginal: form.bankFeeOriginal, bankFeeVnd: form.bankFeeVnd }
            : {}),
        };
        res = await fetch(`/api/orders/${orderId}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? (isEditing ? "Lỗi cập nhật thanh toán" : "Lỗi tạo thanh toán"));
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
          <DialogTitle>{isEditing ? "Chỉnh sửa thanh toán" : "Thêm thanh toán"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loại thanh toán <span className="text-red-500">*</span></Label>
              <Combobox
                value={form.paymentType}
                onValueChange={(v) => setField("paymentType", v)}
                options={[
                  { value: "PAYMENT", label: "Thanh toán" },
                  { value: "REFUND", label: "Hoàn tiền" },
                ]}
                placeholder="Chọn loại"
                disabled={isEditing}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Phương thức <span className="text-red-500">*</span></Label>
              <Combobox
                value={form.paymentMethod}
                onValueChange={(v) => { setField("paymentMethod", v); setField("depositId", ""); }}
                options={[
                  { value: "BANK", label: "Ngân hàng" },
                  { value: "DEPOSIT", label: "Cọc" },
                ]}
                placeholder="Chọn phương thức"
                disabled={isEditing}
              />
            </div>
          </div>

          {form.paymentMethod === "DEPOSIT" && !isEditing && (
            <div className="space-y-1.5">
              <Label>Chọn cọc <span className="text-red-500">*</span></Label>
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
              <Label>Số tiền ({currency.code}) <span className="text-red-500">*</span></Label>
              <NumberInput
                value={form.amountOriginal}
                onChange={(v) => setField("amountOriginal", v)}
                decimals={4}
                min={0}
                placeholder="0.0000"
              />
              {/* Overpayment hint — warn when amount exceeds remaining balance */}
              {maxPaymentAmount && form.paymentType === "PAYMENT" && (
                <p className={`text-xs ${isOverMax ? "text-red-500 font-medium" : "text-slate-500"}`}>
                  Còn phải thanh toán: {new Decimal(maxPaymentAmount).toDecimalPlaces(4).toString()} {currency.code}
                  {isOverMax && " — vượt quá!"}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Tiền tệ</Label>
              <Input value={`${currency.symbol} ${currency.code}`} readOnly className="bg-slate-50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
              <Label>Mã tham chiếu <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Số chứng từ..."
                value={form.bankReference}
                onChange={(e) => setField("bankReference", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Ngày giao dịch <span className="text-red-500">*</span></Label>
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
              {loading ? "Đang lưu..." : isEditing ? "Cập nhật" : "Lưu thanh toán"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Standalone transaction form — RECEIPT/PAYMENT not linked to any order
// amountVnd auto-computed via Decimal.js; supports DEPOSIT payment method
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { getDefaultBu } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberInput } from "@/components/ui/number-input";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method-labels";

interface Currency {
  id: string;
  code: string;
  symbol: string;
}

interface Deposit {
  id: string;
  amountOriginal: string;
  remainingOriginal: string;
  notes: string | null;
  party?: { name: string };
}

interface Party {
  id: string;
  name: string;
  type: string;
}

interface ExpenseType {
  id: string;
  name: string;
  isActive: boolean;
}

interface FormState {
  type: string;
  businessUnitId: string;
  currencyId: string;
  amountOriginal: string;
  exchangeRate: string;
  amountVnd: string;
  paymentMethod: string;
  bankReference: string;
  transactionDate: string;
  notes: string;
  depositId: string;
  partyId: string;
  bankFeeOriginal: string;
  bankFeeVnd: string;
  expenseTypeId: string;
}

const defaultForm: FormState = {
  type: "RECEIPT",
  businessUnitId: "",
  currencyId: "",
  amountOriginal: "",
  exchangeRate: "1",
  amountVnd: "",
  paymentMethod: "BANK",
  bankReference: "",
  transactionDate: new Date().toISOString().split("T")[0],
  notes: "",
  depositId: "",
  partyId: "",
  bankFeeOriginal: "",
  bankFeeVnd: "",
  expenseTypeId: "",
};

interface TransactionFormProps {
  onSuccess?: () => void;
}

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const [form, setForm] = useState<FormState>(() => ({
    ...defaultForm,
    businessUnitId: getDefaultBu(),
  }));
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Load reference data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [curRes, etRes] = await Promise.all([
          fetch("/api/currencies"),
          fetch("/api/expense-types"),
        ]);
        const curJson = await curRes.json();
        const etJson = await etRes.json();
        if (curJson.success) setCurrencies(curJson.data);
        if (etJson.success) setExpenseTypes(etJson.data.filter((e: ExpenseType) => e.isActive));
      } catch {
        setError("Không thể tải dữ liệu tham chiếu");
      }
    }
    loadData();
  }, []);

  // Load parties when BU is selected (for deposit selection)
  useEffect(() => {
    if (form.businessUnitId) {
      fetch(`/api/parties?businessUnitId=${form.businessUnitId}&limit=100`)
        .then((r) => r.json())
        .then((json) => { if (json.success) setParties(json.data); })
        .catch(() => {});
    } else {
      setParties([]);
    }
  }, [form.businessUnitId]);

  // Load deposits when payment method is DEPOSIT and party is selected
  useEffect(() => {
    if (form.paymentMethod === "DEPOSIT" && form.partyId) {
      fetch(`/api/parties/${form.partyId}/deposits`)
        .then((r) => r.json())
        .then((json) => { if (json.success) setDeposits(json.data); })
        .catch(() => setError("Không thể tải danh sách cọc"));
    } else {
      setDeposits([]);
    }
  }, [form.paymentMethod, form.partyId]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      // Recompute amountVnd when amounts or rate change
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
      if (key === "paymentMethod" && value !== "BANK") {
        updated.bankFeeOriginal = "";
        updated.bankFeeVnd = "";
      }
      return updated;
    });
  }

  function validate(): string | null {
    if (!form.type) return "Loại giao dịch là bắt buộc";
    if (!form.businessUnitId) return "Vui lòng chọn đơn vị kinh doanh ở thanh tiêu đề";
    if (!form.currencyId) return "Tiền tệ là bắt buộc";
    if (!form.amountOriginal || isNaN(parseFloat(form.amountOriginal)) || parseFloat(form.amountOriginal) <= 0)
      return "Số tiền phải lớn hơn 0";
    if (!form.exchangeRate || isNaN(parseFloat(form.exchangeRate)) || parseFloat(form.exchangeRate) <= 0)
      return "Tỷ giá không hợp lệ";
    if (!form.paymentMethod) return "Phương thức thanh toán là bắt buộc";
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

    const hasBankFee =
      form.paymentMethod === "BANK" &&
      form.bankFeeOriginal &&
      parseFloat(form.bankFeeOriginal) > 0;

    const payload = {
      type: form.type,
      businessUnitId: form.businessUnitId,
      currencyId: form.currencyId,
      amountOriginal: form.amountOriginal,
      exchangeRate: form.exchangeRate,
      amountVnd: form.amountVnd,
      paymentMethod: form.paymentMethod,
      paymentType: "PAYMENT" as const,
      bankReference: form.bankReference || null,
      transactionDate: form.transactionDate,
      notes: form.notes || null,
      expenseTypeId: form.expenseTypeId || null,
      ...(form.paymentMethod === "DEPOSIT" && form.depositId ? { depositId: form.depositId } : {}),
      ...(hasBankFee
        ? { bankFeeOriginal: form.bankFeeOriginal, bankFeeVnd: form.bankFeeVnd }
        : {}),
    };

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Lỗi tạo giao dịch");
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/transactions");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  const selectedCurrency = currencies.find((c) => c.id === form.currencyId);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Loại giao dịch <span className="text-red-500">*</span></Label>
          <Combobox
            value={form.type}
            onValueChange={(v) => setField("type", v)}
            options={[
              { value: "RECEIPT", label: "Thu tiền" },
              { value: "PAYMENT", label: "Chi tiền" },
            ]}
            placeholder="Chọn loại"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Tiền tệ <span className="text-red-500">*</span></Label>
          <Combobox
            value={form.currencyId}
            onValueChange={(v) => setField("currencyId", v)}
            options={currencies.map((c) => ({ value: c.id, label: `${c.symbol} ${c.code}` }))}
            placeholder="Chọn tiền tệ"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Phương thức thanh toán <span className="text-red-500">*</span></Label>
          <Combobox
            value={form.paymentMethod}
            onValueChange={(v) => { setField("paymentMethod", v); setField("depositId", ""); }}
            options={PAYMENT_METHOD_OPTIONS}
            placeholder="Chọn phương thức"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Loại chi phí</Label>
          <Combobox
            value={form.expenseTypeId}
            onValueChange={(v) => setField("expenseTypeId", v)}
            options={[{ value: "", label: "— Không chọn —" }, ...expenseTypes.map((e) => ({ value: e.id, label: e.name }))]}
            placeholder="Chọn loại chi phí..."
          />
        </div>

        <div className="space-y-1.5">
          <Label>Số tiền {selectedCurrency ? `(${selectedCurrency.code})` : ""} <span className="text-red-500">*</span></Label>
          <NumberInput
            value={form.amountOriginal}
            onChange={(v) => setField("amountOriginal", v)}
            decimals={4}
            min={0}
            placeholder="0.0000"
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

        <div className="space-y-1.5">
          <Label>Thành tiền VND</Label>
          <NumberInput value={form.amountVnd} onChange={() => {}} readOnly decimals={4} />
        </div>

        <div className="space-y-1.5">
          <Label>Mã tham chiếu</Label>
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

      {form.paymentMethod === "BANK" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Phí ngân hàng {selectedCurrency ? `(${selectedCurrency.code})` : ""}</Label>
            <NumberInput
              value={form.bankFeeOriginal}
              onChange={(v) => setField("bankFeeOriginal", v)}
              decimals={4}
              min={0}
              placeholder="0.0000"
            />
            <p className="text-xs text-slate-500">Phí do công ty chịu</p>
          </div>
          <div className="space-y-1.5">
            <Label>Phí VND</Label>
            <NumberInput value={form.bankFeeVnd} onChange={() => {}} readOnly decimals={4} />
          </div>
        </div>
      )}

      {form.paymentMethod === "DEPOSIT" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Đối tác (cọc) <span className="text-red-500">*</span></Label>
            <Combobox
              value={form.partyId}
              onValueChange={(v) => { setField("partyId", v); setField("depositId", ""); }}
              options={parties.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Chọn đối tác..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Chọn cọc <span className="text-red-500">*</span></Label>
            <Combobox
              value={form.depositId}
              onValueChange={(v) => setField("depositId", v)}
              options={deposits.map((d) => ({ value: d.id, label: `Còn lại: ${d.remainingOriginal}` }))}
              placeholder={deposits.length === 0 ? "Không có cọc" : "Chọn cọc..."}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Ghi chú</Label>
        <Textarea
          placeholder="Ghi chú..."
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Hủy
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Đang lưu..." : "Tạo giao dịch"}
        </Button>
      </div>
    </form>
  );
}

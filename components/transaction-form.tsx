// Standalone transaction form — RECEIPT/PAYMENT not linked to any order
// amountVnd auto-computed via Decimal.js; supports DEPOSIT payment method
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

interface BusinessUnit {
  id: string;
  code: string;
  name: string;
}

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
};

interface TransactionFormProps {
  onSuccess?: () => void;
}

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Load reference data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [buRes, curRes] = await Promise.all([
          fetch("/api/business-units"),
          fetch("/api/currencies"),
        ]);
        const [buJson, curJson] = await Promise.all([buRes.json(), curRes.json()]);
        if (buJson.success) setBusinessUnits(buJson.data);
        if (curJson.success) setCurrencies(curJson.data);
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
      return updated;
    });
  }

  function validate(): string | null {
    if (!form.type) return "Loại giao dịch là bắt buộc";
    if (!form.businessUnitId) return "Đơn vị kinh doanh là bắt buộc";
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
      ...(form.paymentMethod === "DEPOSIT" && form.depositId ? { depositId: form.depositId } : {}),
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
          <Label>Loại giao dịch</Label>
          <Select value={form.type} onValueChange={(v) => setField("type", v ?? "")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="RECEIPT">Thu tiền</SelectItem>
              <SelectItem value="PAYMENT">Chi tiền</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Đơn vị kinh doanh</Label>
          <Select value={form.businessUnitId} onValueChange={(v) => setField("businessUnitId", v ?? "")}>
            <SelectTrigger><SelectValue placeholder="Chọn đơn vị" /></SelectTrigger>
            <SelectContent>
              {businessUnits.map((bu) => (
                <SelectItem key={bu.id} value={bu.id}>{bu.code} – {bu.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Tiền tệ</Label>
          <Select value={form.currencyId} onValueChange={(v) => setField("currencyId", v ?? "")}>
            <SelectTrigger><SelectValue placeholder="Chọn tiền tệ" /></SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.symbol} {c.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Phương thức thanh toán</Label>
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

        <div className="space-y-1.5">
          <Label>Số tiền {selectedCurrency ? `(${selectedCurrency.code})` : ""}</Label>
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

      {form.paymentMethod === "DEPOSIT" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Đối tác (cọc)</Label>
            <Select value={form.partyId} onValueChange={(v) => { setField("partyId", v ?? ""); setField("depositId", ""); }}>
              <SelectTrigger><SelectValue placeholder="Chọn đối tác..." /></SelectTrigger>
              <SelectContent>
                {parties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Chọn cọc</Label>
            <Select value={form.depositId} onValueChange={(v) => setField("depositId", v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Chọn cọc..." /></SelectTrigger>
              <SelectContent>
                {deposits.length === 0 ? (
                  <SelectItem value="__none" disabled>Không có cọc</SelectItem>
                ) : (
                  deposits.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      Còn lại: {d.remainingOriginal}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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

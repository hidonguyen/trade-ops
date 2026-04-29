// Order create/edit form — handles SALE and PURCHASE types
// Sub-fields extracted to order-form-fields.tsx to stay under 200 LOC
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { getDefaultBu } from "@/lib/utils";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberInput } from "@/components/ui/number-input";
import {
  ExchangeRateField,
  ExpenseTypeField,
  PaymentDueDateField,
  NotesField,
} from "@/components/order-form-fields";

interface Party { id: string; name: string; type: string; }
interface Currency { id: string; code: string; symbol: string; }
interface ExpenseType { id: string; name: string; isActive: boolean; }

export interface OrderFormData {
  type: string;
  partyId: string;
  businessUnitId: string;
  orderNumber: string;
  amountOriginal: string;
  currencyId: string;
  orderDate: string;
  notes: string;
  expenseTypeId: string; // PURCHASE-only; server rejects on SALE
  exchangeRate: string;  // exchange rate to VND; default "1" for VND orders
  paymentDueDate: string; // optional ISO date string or ""
}

interface OrderFormProps {
  initialData?: Partial<OrderFormData> & { id?: string };
  onSubmit: (data: OrderFormData) => Promise<void>;
  mode: "create" | "edit";
  lockType?: boolean;
  // Disable amount + currency edit when any transaction exists
  lockAmountCurrency?: boolean;
  // Disable party edit when any DEPOSIT-method transaction exists
  lockParty?: boolean;
}

const defaultForm: OrderFormData = {
  type: "SALE",
  partyId: "",
  businessUnitId: "",
  orderNumber: "",
  amountOriginal: "",
  currencyId: "",
  orderDate: new Date().toISOString().split("T")[0],
  notes: "",
  expenseTypeId: "",
  exchangeRate: "1",
  paymentDueDate: "",
};

export function OrderForm({ initialData, onSubmit, mode, lockType, lockAmountCurrency, lockParty }: OrderFormProps) {
  const [form, setForm] = useState<OrderFormData>(() => ({
    ...defaultForm,
    businessUnitId: getDefaultBu(),
    ...initialData,
  }));
  const [parties, setParties] = useState<Party[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { businessUnits } = useSelectedBu();

  const orderNumberMode = useMemo(() => {
    const bu = businessUnits.find((b) => b.id === form.businessUnitId);
    return bu?.orderNumberMode ?? "MANUAL";
  }, [businessUnits, form.businessUnitId]);
  const isAutoNumber = orderNumberMode === "AUTO" && mode === "create";

  const selectedCurrency = useMemo(
    () => currencies.find((c) => c.id === form.currencyId),
    [currencies, form.currencyId]
  );
  const isVnd = selectedCurrency?.code === "VND";

  useEffect(() => {
    if (isVnd) setForm((prev) => ({ ...prev, exchangeRate: "1" }));
  }, [isVnd]);

  const derivedVnd = useMemo(() => {
    try {
      const amt = new Decimal(form.amountOriginal || "0");
      const rate = new Decimal(form.exchangeRate || "1");
      if (amt.isZero()) return null;
      return amt.times(rate).toDecimalPlaces(0).toNumber().toLocaleString("vi-VN") + " ₫";
    } catch { return null; }
  }, [form.amountOriginal, form.exchangeRate]);

  const showRateWarning =
    !isVnd &&
    Boolean(form.currencyId) &&
    (!form.exchangeRate || form.exchangeRate === "1" || parseFloat(form.exchangeRate) <= 1);

  useEffect(() => {
    async function loadData() {
      try {
        const [curRes, etRes] = await Promise.all([
          fetch("/api/currencies"),
          fetch("/api/expense-types"),
        ]);
        const curJson = await curRes.json();
        if (curJson.success) setCurrencies(curJson.data);
        const etJson = await etRes.json();
        if (etJson.success) setExpenseTypes(etJson.data);
      } catch {
        setError("Không thể tải dữ liệu tham chiếu");
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (form.type !== "PURCHASE" && form.expenseTypeId) {
      setForm((prev) => ({ ...prev, expenseTypeId: "" }));
    }
  }, [form.type, form.expenseTypeId]);

  useEffect(() => {
    async function loadParties() {
      try {
        const partyType = form.type === "SALE" ? "CUSTOMER" : "SUPPLIER";
        const res = await fetch(`/api/parties?type=${partyType}`);
        const json = await res.json();
        if (json.success) setParties(json.data);
      } catch {
        setError("Không thể tải danh sách đối tác");
      }
    }
    loadParties();
  }, [form.type]);

  function setField<K extends keyof OrderFormData>(key: K, value: OrderFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!form.type) return "Loại đơn là bắt buộc";
    if (!form.partyId) return "Đối tác là bắt buộc";
    if (!form.businessUnitId) return "Vui lòng chọn đơn vị kinh doanh ở thanh tiêu đề";
    if (!isAutoNumber && !form.orderNumber.trim()) return "Số đơn hàng là bắt buộc";
    if (!form.amountOriginal || isNaN(parseFloat(form.amountOriginal))) return "Số tiền không hợp lệ";
    if (!form.currencyId) return "Tiền tệ là bắt buộc";
    if (!form.orderDate) return "Ngày đặt là bắt buộc";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Loại đơn <span className="text-red-500">*</span></Label>
          <Combobox
            value={form.type}
            onValueChange={(v) => { setField("type", v); setField("partyId", ""); }}
            options={[{ value: "SALE", label: "Bán hàng" }, { value: "PURCHASE", label: "Mua hàng" }]}
            placeholder="Chọn loại"
            disabled={mode === "edit" || lockType}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Đối tác <span className="text-red-500">*</span></Label>
          <Combobox
            value={form.partyId}
            onValueChange={(v) => setField("partyId", v)}
            options={parties.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Chọn đối tác"
            disabled={lockParty}
          />
          {lockParty && (
            <p className="text-xs text-slate-500">Đã thanh toán bằng cọc — không thể đổi đối tác</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Số đơn hàng {!isAutoNumber && <span className="text-red-500">*</span>}</Label>
          <Input
            value={isAutoNumber ? "" : form.orderNumber}
            onChange={(e) => setField("orderNumber", e.target.value)}
            placeholder={isAutoNumber ? "Tự động tạo khi lưu" : "VD: PO-2026-001"}
            disabled={isAutoNumber}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Tiền tệ <span className="text-red-500">*</span></Label>
          <Combobox
            value={form.currencyId}
            onValueChange={(v) => setField("currencyId", v)}
            options={currencies.map((c) => ({ value: c.id, label: `${c.symbol} ${c.code}` }))}
            placeholder="Chọn tiền tệ"
            disabled={lockAmountCurrency}
          />
          {lockAmountCurrency && (
            <p className="text-xs text-slate-500">Đã có giao dịch — không thể đổi tiền tệ</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Số tiền <span className="text-red-500">*</span></Label>
          <NumberInput
            value={form.amountOriginal}
            onChange={(v) => setField("amountOriginal", v)}
            decimals={4}
            min={0}
            placeholder="0.0000"
            disabled={lockAmountCurrency}
          />
          {lockAmountCurrency && (
            <p className="text-xs text-slate-500">Đã có giao dịch — không thể sửa số tiền</p>
          )}
        </div>

        <ExchangeRateField
          exchangeRate={form.exchangeRate}
          isVnd={isVnd}
          showRateWarning={showRateWarning}
          derivedVnd={derivedVnd}
          currencyCode={selectedCurrency?.code ?? ""}
          onChange={(v) => setField("exchangeRate", v)}
        />

        <div className="space-y-1.5">
          <Label>Ngày đặt <span className="text-red-500">*</span></Label>
          <DatePicker value={form.orderDate} onChange={(v) => setField("orderDate", v)} />
        </div>

        <PaymentDueDateField
          value={form.paymentDueDate}
          onChange={(v) => setField("paymentDueDate", v)}
        />

        {form.type === "PURCHASE" && (
          <ExpenseTypeField
            value={form.expenseTypeId}
            expenseTypes={expenseTypes}
            onChange={(v) => setField("expenseTypeId", v)}
          />
        )}
      </div>

      <NotesField value={form.notes} onChange={(v) => setField("notes", v)} />

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>Hủy</Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Đang lưu..." : mode === "create" ? "Tạo đơn" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}

// Order create/edit form — handles SALE and PURCHASE types
// Fetches parties (filtered by type), business units, currencies on mount
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDefaultBu } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberInput } from "@/components/ui/number-input";

interface Party {
  id: string;
  name: string;
  type: string;
}

interface Currency {
  id: string;
  code: string;
  symbol: string;
}

export interface OrderFormData {
  type: string;
  partyId: string;
  businessUnitId: string;
  amountOriginal: string;
  currencyId: string;
  orderDate: string;
  notes: string;
}

interface OrderFormProps {
  initialData?: Partial<OrderFormData> & { id?: string };
  onSubmit: (data: OrderFormData) => Promise<void>;
  mode: "create" | "edit";
}

const defaultForm: OrderFormData = {
  type: "SALE",
  partyId: "",
  businessUnitId: "",
  amountOriginal: "",
  currencyId: "",
  orderDate: new Date().toISOString().split("T")[0],
  notes: "",
};

export function OrderForm({ initialData, onSubmit, mode }: OrderFormProps) {
  const [form, setForm] = useState<OrderFormData>(() => ({
    ...defaultForm,
    businessUnitId: getDefaultBu(),
    ...initialData,
  }));
  const [parties, setParties] = useState<Party[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Load reference data
  useEffect(() => {
    async function loadData() {
      try {
        const curRes = await fetch("/api/currencies");
        const curJson = await curRes.json();
        if (curJson.success) setCurrencies(curJson.data);
      } catch {
        setError("Không thể tải dữ liệu tham chiếu");
      }
    }
    loadData();
  }, []);

  // Reload parties when type changes
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
    if (!form.amountOriginal || isNaN(parseFloat(form.amountOriginal)))
      return "Số tiền không hợp lệ";
    if (!form.currencyId) return "Tiền tệ là bắt buộc";
    if (!form.orderDate) return "Ngày đặt là bắt buộc";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
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
          <Label>Loại đơn</Label>
          <Combobox
            value={form.type}
            onValueChange={(v) => { setField("type", v); setField("partyId", ""); }}
            options={[
              { value: "SALE", label: "Bán hàng" },
              { value: "PURCHASE", label: "Mua hàng" },
            ]}
            placeholder="Chọn loại"
            disabled={mode === "edit"}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Đối tác</Label>
          <Combobox
            value={form.partyId}
            onValueChange={(v) => setField("partyId", v)}
            options={parties.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Chọn đối tác"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Tiền tệ</Label>
          <Combobox
            value={form.currencyId}
            onValueChange={(v) => setField("currencyId", v)}
            options={currencies.map((c) => ({ value: c.id, label: `${c.symbol} ${c.code}` }))}
            placeholder="Chọn tiền tệ"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Số tiền</Label>
          <NumberInput
            value={form.amountOriginal}
            onChange={(v) => setField("amountOriginal", v)}
            decimals={4}
            min={0}
            placeholder="0.0000"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Ngày đặt</Label>
          <DatePicker
            value={form.orderDate}
            onChange={(v) => setField("orderDate", v)}
          />
        </div>
      </div>

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
          {loading ? "Đang lưu..." : mode === "create" ? "Tạo đơn" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}

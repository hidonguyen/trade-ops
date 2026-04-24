// Extracted field sub-components for OrderForm to keep order-form.tsx under 200 LOC
"use client";

import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";

interface ExpenseType { id: string; name: string; isActive: boolean; }

interface ExchangeRateFieldProps {
  exchangeRate: string;
  isVnd: boolean;
  showRateWarning: boolean;
  derivedVnd: string | null;
  currencyCode: string;
  onChange: (v: string) => void;
}

export function ExchangeRateField({
  exchangeRate, isVnd, showRateWarning, derivedVnd, currencyCode, onChange,
}: ExchangeRateFieldProps) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Tỷ giá (sang VND)</Label>
        <NumberInput
          value={exchangeRate}
          onChange={onChange}
          decimals={8}
          min={0}
          placeholder="1"
          disabled={isVnd}
        />
        {showRateWarning && (
          <p className="text-xs text-amber-600">
            Vui lòng nhập tỷ giá cho tiền tệ khác VND
          </p>
        )}
      </div>
      {derivedVnd && !isVnd && (
        <div className="space-y-1.5">
          <Label>Tương đương VND</Label>
          <p className="text-sm font-mono text-slate-700 pt-1">≈ {derivedVnd}</p>
        </div>
      )}
      {/* Placeholder cell so grid stays aligned when no VND display */}
      {(isVnd || !derivedVnd) && <div />}
    </>
  );
}

interface ExpenseTypeFieldProps {
  value: string;
  expenseTypes: ExpenseType[];
  onChange: (v: string) => void;
}

export function ExpenseTypeField({ value, expenseTypes, onChange }: ExpenseTypeFieldProps) {
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label>Loại chi phí</Label>
      <Combobox
        value={value}
        onValueChange={onChange}
        options={[
          { value: "", label: "— Chưa phân loại —" },
          ...expenseTypes
            .filter((e) => e.isActive || e.id === value)
            .map((e) => ({
              value: e.id,
              label: e.isActive ? e.name : `${e.name} (ngừng)`,
            })),
        ]}
        placeholder="Chọn loại chi phí (tùy chọn)"
      />
    </div>
  );
}

interface PaymentDueDateFieldProps {
  value: string;
  onChange: (v: string) => void;
}

export function PaymentDueDateField({ value, onChange }: PaymentDueDateFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>Hạn thanh toán</Label>
      <DatePicker value={value} onChange={onChange} />
    </div>
  );
}

interface NotesFieldProps {
  value: string;
  onChange: (v: string) => void;
}

export function NotesField({ value, onChange }: NotesFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>Diễn giải</Label>
      <Textarea
        placeholder="Diễn giải..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    </div>
  );
}

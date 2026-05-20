// Dialog for editing standalone transactions (RECEIPT/PAYMENT)
// Locks type, paymentMethod, currency — only editable: amount, rate, reference, date, notes, fees, expenseTypeId
"use client";

import { useState, useEffect } from "react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberInput } from "@/components/ui/number-input";
import { Combobox } from "@/components/ui/combobox";
import { getPaymentMethodLabel } from "@/lib/payment-method-labels";
import { ContactQuickCreateDialog, type QuickContact } from "@/components/contact-quick-create-dialog";
import { PlusIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExpenseType {
  id: string;
  name: string;
  isActive: boolean;
}

interface ContactOption {
  id: string;
  name: string;
  phone?: string | null;
}

export interface EditableTransaction {
  id: string;
  type: string;
  paymentMethod: string;
  amountOriginal: string;
  amountVnd: string;
  exchangeRate: string;
  bankReference: string | null;
  transactionDate: string;
  notes: string | null;
  bankFeeOriginal: string | null;
  bankFeeVnd: string | null;
  businessUnitId?: string;
  currency: { id: string; code: string; symbol: string };
  businessUnit?: { id: string; code: string; name: string };
  expenseType?: { id: string; name: string; isActive: boolean } | null;
  contact?: { id: string; name: string; phone: string | null } | null;
}

interface TransactionEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transaction: EditableTransaction | null;
}

interface EditFormState {
  amountOriginal: string;
  exchangeRate: string;
  amountVnd: string;
  bankReference: string;
  transactionDate: string;
  notes: string;
  expenseTypeId: string;
  contactId: string;
}

const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Thu tiền",
  PAYMENT: "Chi tiền",
};

export function TransactionEditDialog({ open, onClose, onSuccess, transaction }: TransactionEditDialogProps) {
  const [form, setForm] = useState<EditFormState>({
    amountOriginal: "", exchangeRate: "1", amountVnd: "",
    bankReference: "", transactionDate: "", notes: "", expenseTypeId: "", contactId: "",
  });
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load expense types once
  useEffect(() => {
    fetch("/api/expense-types")
      .then((r) => r.json())
      .then((json) => { if (json.success) setExpenseTypes(json.data.filter((e: ExpenseType) => e.isActive)); })
      .catch(() => {});
  }, []);

  // Contacts are BU-scoped: refetch when dialog opens or transaction (BU) changes.
  useEffect(() => {
    if (!open) return;
    const buId = transaction?.businessUnitId ?? transaction?.businessUnit?.id;
    const url = buId
      ? `/api/contacts?pageSize=200&businessUnitId=${buId}`
      : "/api/contacts?pageSize=200";
    fetch(url)
      .then((r) => r.json())
      .then((json) => { if (json.success) setContacts(json.data.items ?? []); })
      .catch(() => {});
  }, [open, transaction]);

  // Pre-fill form when dialog opens
  useEffect(() => {
    if (!open || !transaction) return;
    setError(null);
    setForm({
      amountOriginal: transaction.amountOriginal,
      exchangeRate: transaction.exchangeRate,
      amountVnd: transaction.amountVnd,
      bankReference: transaction.bankReference ?? "",
      transactionDate: transaction.transactionDate.split("T")[0],
      notes: transaction.notes ?? "",
      expenseTypeId: transaction.expenseType?.id ?? "",
      contactId: transaction.contact?.id ?? "",
    });
  }, [open, transaction]);

  if (!transaction) return null;

  const currencyCode = transaction.currency?.code ?? "VND";
  const currencySymbol = transaction.currency?.symbol ?? "₫";

  function setField<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === "amountOriginal" || key === "exchangeRate") {
        try {
          const amt = new Decimal(updated.amountOriginal || "0");
          const rate = new Decimal(updated.exchangeRate || "1");
          updated.amountVnd = amt.times(rate).toDecimalPlaces(4).toString();
        } catch { updated.amountVnd = ""; }
      }
      // Bank fees are set at creation time and not editable
      return updated;
    });
  }

  function validate(): string | null {
    if (!form.amountOriginal || isNaN(parseFloat(form.amountOriginal)) || parseFloat(form.amountOriginal) <= 0)
      return "Số tiền phải lớn hơn 0";
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

    const payload: Record<string, unknown> = {
      amountOriginal: form.amountOriginal,
      amountVnd: form.amountVnd,
      exchangeRate: form.exchangeRate,
      bankReference: form.bankReference || null,
      transactionDate: form.transactionDate,
      notes: form.notes || null,
      expenseTypeId: form.expenseTypeId || null,
      contactId: form.contactId || null,
    };

    try {
      const res = await fetch(`/api/transactions/${transaction!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Lỗi cập nhật giao dịch");
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
          <DialogTitle>Chỉnh sửa giao dịch</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Locked fields — display only */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loại giao dịch</Label>
              <Input value={TYPE_LABEL[transaction.type] ?? transaction.type} readOnly className="bg-slate-50" />
            </div>
            <div className="space-y-1.5">
              <Label>Tiền tệ</Label>
              <Input value={`${currencySymbol} ${currencyCode}`} readOnly className="bg-slate-50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Số tiền ({currencyCode}) <span className="text-red-500">*</span></Label>
              <NumberInput
                value={form.amountOriginal}
                onChange={(v) => setField("amountOriginal", v)}
                decimals={4}
                min={0}
                placeholder="0.0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phương thức</Label>
              <Input value={getPaymentMethodLabel(transaction.paymentMethod)} readOnly className="bg-slate-50" />
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
              <Label>Ngày giao dịch <span className="text-red-500">*</span></Label>
              <DatePicker
                value={form.transactionDate}
                onChange={(v) => setField("transactionDate", v)}
              />
            </div>
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
            <Label>Người {transaction.type === "RECEIPT" ? "nộp" : "nhận"}</Label>
            <div className="flex gap-2">
              <Combobox
                value={form.contactId}
                onValueChange={(v) => setField("contactId", v)}
                options={[
                  { value: "", label: "— Không chọn —" },
                  ...contacts.map((c) => ({
                    value: c.id,
                    label: c.phone ? `${c.name} • ${c.phone}` : c.name,
                  })),
                ]}
                placeholder="Chọn người nộp/nhận..."
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="Thêm người nộp/nhận mới"
                onClick={() => setContactDialogOpen(true)}
              >
                <PlusIcon className="size-4" />
              </Button>
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
              {loading ? "Đang lưu..." : "Cập nhật"}
            </Button>
          </div>
        </form>
      </DialogContent>
      <ContactQuickCreateDialog
        open={contactDialogOpen}
        businessUnitId={transaction.businessUnitId ?? transaction.businessUnit?.id}
        onClose={() => setContactDialogOpen(false)}
        onCreated={(c: QuickContact) => {
          setContacts((prev) => [{ id: c.id, name: c.name, phone: c.phone ?? null }, ...prev]);
          setField("contactId", c.id);
        }}
      />
    </Dialog>
  );
}

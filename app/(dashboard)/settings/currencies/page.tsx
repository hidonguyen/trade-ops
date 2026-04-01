// Currencies CRUD — ADMIN only client page
"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DataTable, Column } from "@/components/shared/data-table";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
}

interface FormState { code: string; name: string; symbol: string; }
const EMPTY_FORM: FormState = { code: "", name: "", symbol: "" };

export default function CurrenciesPage() {
  const [items, setItems] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Currency | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Currency | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/currencies");
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch {
      setError("Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(item: Currency) {
    setEditTarget(item);
    setForm({ code: item.code, name: item.name, symbol: item.symbol });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim() || !form.symbol.trim()) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editTarget ? `/api/currencies/${editTarget.id}` : "/api/currencies";
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.success) { setError(json.message ?? "Lỗi không xác định"); return; }
      setDialogOpen(false);
      fetchItems();
    } catch {
      setError("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/currencies/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchItems();
    } catch {
      setError("Không thể xóa");
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "code", label: "Mã", sortable: true },
    { key: "symbol", label: "Ký hiệu", align: "center" },
    { key: "name", label: "Tên", sortable: true },
    {
      key: "isActive", label: "Trạng thái",
      render: (v) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${v ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}>
          {v ? "Hoạt động" : "Ngừng"}
        </span>
      ),
    },
    {
      key: "id", label: "", align: "right",
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <Button size="icon-sm" variant="ghost"
            onClick={(e) => { e.stopPropagation(); openEdit(row as unknown as Currency); }}>
            <PencilIcon className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" className="text-red-500 hover:text-red-700"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(row as unknown as Currency); }}>
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tiền tệ</h1>
          <p className="text-sm text-slate-500">Quản lý các loại tiền tệ trong hệ thống</p>
        </div>
        <Button onClick={openCreate} size="sm"><PlusIcon className="size-4 mr-1" />Thêm mới</Button>
      </div>

      <DataTable columns={columns} data={items as unknown as Record<string, unknown>[]} loading={loading} emptyMessage="Chưa có tiền tệ nào" />

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Sửa tiền tệ" : "Thêm tiền tệ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="cur-code">Mã tiền tệ</Label>
              <Input id="cur-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="VD: VND, USD" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cur-symbol">Ký hiệu</Label>
              <Input id="cur-symbol" value={form.symbol} onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))} placeholder="VD: ₫, $, ¥" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cur-name">Tên đầy đủ</Label>
              <Input id="cur-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="VD: Việt Nam Đồng" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Xóa tiền tệ"
        description={`Bạn có chắc muốn xóa "${deleteTarget?.name}"?`}
        variant="danger"
        confirmLabel="Xóa"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

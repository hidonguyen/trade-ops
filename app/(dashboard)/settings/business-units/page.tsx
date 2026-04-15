// Business Units CRUD — ADMIN only client page
"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DataTable, Column } from "@/components/shared/data-table";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { useSelectedBu } from "@/components/providers/bu-provider";

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  orderNumberMode: "MANUAL" | "AUTO";
  isActive: boolean;
}

type OrderNumberMode = "MANUAL" | "AUTO";
interface FormState { name: string; code: string; orderNumberMode: OrderNumberMode; }
const EMPTY_FORM: FormState = { name: "", code: "", orderNumberMode: "MANUAL" };

const ORDER_NUMBER_MODE_OPTIONS = [
  { value: "MANUAL", label: "Nhập tay" },
  { value: "AUTO", label: "Tự động tạo" },
];
const MODE_LABELS: Record<OrderNumberMode, string> = { MANUAL: "Nhập tay", AUTO: "Tự động" };

export default function BusinessUnitsPage() {
  const { refetch: refetchGlobalBus } = useSelectedBu();
  const [items, setItems] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BusinessUnit | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BusinessUnit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/business-units");
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

  function openEdit(bu: BusinessUnit) {
    setEditTarget(bu);
    setForm({ name: bu.name, code: bu.code, orderNumberMode: bu.orderNumberMode ?? "MANUAL" });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) {
      setError("Tên và mã không được để trống");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editTarget ? `/api/business-units/${editTarget.id}` : "/api/business-units";
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.success) { setError(json.message ?? "Lỗi không xác định"); return; }
      setDialogOpen(false);
      fetchItems();
      // Sync global BU cache so other pages (order form, etc.) see updated orderNumberMode immediately
      refetchGlobalBus();
    } catch {
      setError("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/business-units/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchItems();
      refetchGlobalBus();
    } catch {
      setError("Không thể xóa");
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "code", label: "Mã", sortable: true },
    { key: "name", label: "Tên", sortable: true },
    {
      key: "orderNumberMode", label: "Số đơn hàng",
      render: (v) => <span className="text-sm text-slate-600">{MODE_LABELS[(v as OrderNumberMode) ?? "MANUAL"]}</span>,
    },
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
          <Button size="icon-sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row as unknown as BusinessUnit); }}>
            <PencilIcon className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" className="text-red-500 hover:text-red-700"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(row as unknown as BusinessUnit); }}>
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
          <h1 className="text-xl font-bold text-slate-900">Đơn vị kinh doanh</h1>
          <p className="text-sm text-slate-500">Quản lý các đơn vị kinh doanh</p>
        </div>
        <Button onClick={openCreate} size="sm"><PlusIcon className="size-4 mr-1" />Thêm mới</Button>
      </div>

      <DataTable columns={columns} data={items as unknown as Record<string, unknown>[]} loading={loading} emptyMessage="Chưa có đơn vị kinh doanh nào" />

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Sửa đơn vị kinh doanh" : "Thêm đơn vị kinh doanh"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="bu-name">Tên</Label>
              <Input id="bu-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tên đơn vị kinh doanh" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bu-code">Mã</Label>
              <Input id="bu-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="VD: TK, NT" />
            </div>
            <div className="space-y-1.5">
              <Label>Chế độ số đơn hàng</Label>
              <Combobox
                value={form.orderNumberMode}
                onValueChange={(v) => setForm((f) => ({ ...f, orderNumberMode: (v as OrderNumberMode) || "MANUAL" }))}
                options={ORDER_NUMBER_MODE_OPTIONS}
                placeholder="Chọn chế độ"
              />
              <p className="text-xs text-slate-500">
                Nhập tay: người dùng tự điền số đơn. Tự động: hệ thống tạo số kế tiếp theo từng đối tác.
              </p>
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
        title="Xóa đơn vị kinh doanh"
        description={`Bạn có chắc muốn xóa "${deleteTarget?.name}"?`}
        variant="danger"
        confirmLabel="Xóa"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

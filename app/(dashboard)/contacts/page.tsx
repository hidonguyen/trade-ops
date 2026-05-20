// Contacts (Người Nộp/Nhận) CRUD — ADMIN-only client page.
// Pattern mirrors /settings/expense-types: DataTable + inline dialog form.
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, PencilIcon, Trash2Icon, ArrowLeftIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DataTable, Column } from "@/components/shared/data-table";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { useSelectedBu } from "@/components/providers/bu-provider";

interface ContactBuLink {
  businessUnit: { id: string; code: string; name: string };
}
interface Contact {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
  businessUnits?: ContactBuLink[];
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  taxId: string;
  address: string;
  notes: string;
  isActive: boolean;
  // Multi-BU sharing — mirrors Party form.
  businessUnitIds: string[];
  shareAll: boolean;
}
const EMPTY_FORM: FormState = {
  name: "", phone: "", email: "", taxId: "", address: "", notes: "", isActive: true,
  businessUnitIds: [], shareAll: true,
};

const STATUS_OPTIONS = [
  { value: "true", label: "Hoạt động" },
  { value: "false", label: "Ngừng" },
];

export default function ContactsPage() {
  const router = useRouter();
  const { businessUnits, selectedBuId } = useSelectedBu();
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Contact | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async (q: string, buId: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ includeInactive: "true", pageSize: "100" });
      if (q.trim()) params.set("q", q.trim());
      if (buId) params.set("businessUnitId", buId);
      const res = await fetch(`/api/contacts?${params}`);
      const json = await res.json();
      if (json.success) setItems(json.data.items ?? []);
    } catch {
      setError("Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search; also refetch whenever the header BU dropdown changes.
  useEffect(() => {
    const t = setTimeout(() => fetchItems(search, selectedBuId ?? null), 250);
    return () => clearTimeout(t);
  }, [search, selectedBuId, fetchItems]);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(item: Contact) {
    setEditTarget(item);
    const linkedBuIds = (item.businessUnits ?? []).map((l) => l.businessUnit.id);
    setForm({
      name: item.name ?? "",
      phone: item.phone ?? "",
      email: item.email ?? "",
      taxId: item.taxId ?? "",
      address: item.address ?? "",
      notes: item.notes ?? "",
      isActive: item.isActive ?? true,
      businessUnitIds: linkedBuIds,
      shareAll: false,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Tên không được để trống");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editTarget ? `/api/contacts/${editTarget.id}` : "/api/contacts";
      const method = editTarget ? "PATCH" : "POST";
      // shareAll → send `businessUnitIds: []`; server backfills with all active BUs.
      const { shareAll, businessUnitIds, ...rest } = form;
      const payload = shareAll
        ? { ...rest, businessUnitIds: [] }
        : { ...rest, businessUnitIds: [...new Set(businessUnitIds)] };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Lỗi không xác định");
        return;
      }
      setDialogOpen(false);
      fetchItems(search, selectedBuId ?? null);
    } catch {
      setError("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/contacts/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) setError(json.message ?? "Không thể xóa");
      setDeleteTarget(null);
      fetchItems(search, selectedBuId ?? null);
    } catch {
      setError("Không thể xóa");
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "name", label: "Tên", sortable: true },
    { key: "phone", label: "SĐT", render: (v) => (v as string) || "—" },
    { key: "taxId", label: "MST", render: (v) => (v as string) || "—" },
    {
      key: "businessUnits",
      label: "Đơn vị",
      render: (_, row) => {
        const links = (row as unknown as Contact).businessUnits ?? [];
        if (links.length === 0) return <span className="text-xs text-slate-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {links.map((l) => (
              <span key={l.businessUnit.id} className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                {l.businessUnit.code}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "isActive",
      label: "Trạng thái",
      render: (v) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${v ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}>
          {v ? "Hoạt động" : "Ngừng"}
        </span>
      ),
    },
    {
      key: "id",
      label: "",
      align: "right",
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <Button size="icon-sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row as unknown as Contact); }}>
            <PencilIcon className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" className="text-red-500 hover:text-red-700"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(row as unknown as Contact); }}>
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Người nộp/nhận</h1>
            <p className="text-sm text-slate-500">Danh bạ cá nhân dùng cho phiếu thu/chi</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm"><PlusIcon className="size-4 mr-1" />Thêm mới</Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-slate-400 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc số điện thoại"
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={items as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Chưa có liên hệ nào"
      />

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Sửa người nộp/nhận" : "Thêm người nộp/nhận"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-name">Tên *</Label>
                <Input id="c-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Họ và tên" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">Số điện thoại</Label>
                <Input id="c-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="VD: 0912345678" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email</Label>
                <Input id="c-email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-tax">MST cá nhân</Label>
                <Input id="c-tax" value={form.taxId} onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))} placeholder="MST (tùy chọn)" />
              </div>
              {editTarget && (
                <div className="space-y-1.5">
                  <Label>Trạng thái</Label>
                  <Combobox
                    value={String(form.isActive)}
                    onValueChange={(v) => setForm((f) => ({ ...f, isActive: v === "true" }))}
                    options={STATUS_OPTIONS}
                    placeholder="Chọn trạng thái"
                    className="w-full"
                  />
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-address">Địa chỉ</Label>
                <Input id="c-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Địa chỉ (tùy chọn)" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-notes">Ghi chú</Label>
                <Textarea id="c-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Ghi chú (tùy chọn)" />
              </div>
              <div className="space-y-2 sm:col-span-2 border-t pt-3">
                <Label>Đơn vị sử dụng</Label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.shareAll}
                    onChange={(e) => setForm((f) => ({ ...f, shareAll: e.target.checked }))}
                    className="size-4"
                  />
                  <span>Chung tất cả BU (mọi đơn vị đều thấy)</span>
                </label>
                {!form.shareAll && (
                  <div className="space-y-1.5 pl-6">
                    {businessUnits.map((bu) => (
                      <label key={bu.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.businessUnitIds.includes(bu.id)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...form.businessUnitIds, bu.id]
                              : form.businessUnitIds.filter((id) => id !== bu.id);
                            setForm((f) => ({ ...f, businessUnitIds: next }));
                          }}
                          className="size-4"
                        />
                        <span>{bu.code} — {bu.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
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
        title="Xóa người nộp/nhận"
        description={`Bạn có chắc muốn xóa "${deleteTarget?.name}"? Nếu đã có giao dịch tham chiếu, sẽ chuyển sang trạng thái Ngừng thay vì xóa cứng.`}
        variant="danger"
        confirmLabel="Xóa"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

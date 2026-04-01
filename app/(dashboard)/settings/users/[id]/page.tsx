// User edit/detail page — PATCH /api/users/[id], deactivate with confirmation
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeftIcon, UserXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserForm, UserFormData } from "@/components/user-form";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";

interface UserDetail {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roles: { role: string }[];
}

export default function UserEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = params.id;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users/${userId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setUser(json.data);
        else setError(json.message ?? "Không tải được người dùng");
      })
      .catch(() => setError("Lỗi kết nối máy chủ"))
      .finally(() => setLoading(false));
  }, [userId]);

  async function handleSubmit(data: UserFormData) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        router.push("/settings/users");
      } else {
        const fieldErrors = json.errors
          ? Object.values(json.errors as Record<string, string[]>).flat().join(", ")
          : null;
        setError(fieldErrors ?? json.message ?? "Lỗi không xác định");
      }
    } catch {
      setError("Lỗi kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    setDeactivating(true);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        router.push("/settings/users");
      } else {
        setError(json.message ?? "Không thể vô hiệu hoá người dùng");
        setDeactivateOpen(false);
      }
    } catch {
      setError("Lỗi kết nối máy chủ");
      setDeactivateOpen(false);
    } finally {
      setDeactivating(false);
    }
  }

  const initialData: Partial<UserFormData> | undefined = user
    ? {
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        roles: user.roles.map((r) => r.role) as UserFormData["roles"],
      }
    : undefined;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {loading ? <Skeleton className="h-7 w-40" /> : (user?.name ?? "Người dùng")}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">Chỉnh sửa tài khoản</p>
          </div>
        </div>
        {user?.isActive && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setDeactivateOpen(true)}
            disabled={deactivating}
          >
            <UserXIcon className="size-4 mr-1.5" />
            Vô hiệu hoá
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        ) : initialData ? (
          <UserForm
            mode="edit"
            initialData={initialData}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={null}
          />
        ) : (
          <p className="text-sm text-slate-400">Không tìm thấy người dùng</p>
        )}
      </div>

      <ConfirmationDialog
        open={deactivateOpen}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateOpen(false)}
        title="Vô hiệu hoá tài khoản"
        description={`Bạn có chắc muốn vô hiệu hoá tài khoản "${user?.name}"? Người dùng sẽ không thể đăng nhập.`}
        variant="danger"
        confirmLabel="Vô hiệu hoá"
      />
    </div>
  );
}

// Create user page — POST /api/users, redirect to list on success
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserForm, UserFormData } from "@/components/user-form";

export default function NewUserPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: UserFormData) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Thêm người dùng</h1>
          <p className="mt-0.5 text-sm text-slate-500">Tạo tài khoản mới trong hệ thống</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <UserForm mode="create" onSubmit={handleSubmit} submitting={submitting} error={error} />
      </div>
    </div>
  );
}

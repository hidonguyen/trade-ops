// Create new party page
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartyForm, PartyFormData } from "@/components/party-form";

export default function NewPartyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Preselect partner type when arriving from Customers/Suppliers menu
  const typeParam = searchParams.get("type");
  const defaultType: "CUSTOMER" | "SUPPLIER" | undefined =
    typeParam === "CUSTOMER" || typeParam === "SUPPLIER" ? typeParam : undefined;

  async function handleSubmit(data: PartyFormData) {
    const res = await fetch("/api/parties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message ?? "Lỗi tạo đối tác");
    router.push(`/parties/${json.data.id}`);
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-xl font-bold text-slate-900">Thêm đối tác mới</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin đối tác</CardTitle>
        </CardHeader>
        <CardContent>
          <PartyForm
            mode="create"
            onSubmit={handleSubmit}
            initialData={defaultType ? { type: defaultType } : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

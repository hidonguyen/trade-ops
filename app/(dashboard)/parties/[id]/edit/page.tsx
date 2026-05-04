// Edit party page — fetches existing data then renders PartyForm in edit mode
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { useRegisterPartyDetailType } from "@/components/providers/nav-highlight-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PartyForm, PartyFormData } from "@/components/party-form";

interface Party {
  id: string;
  name: string;
  type: "CUSTOMER" | "SUPPLIER";
  businessUnitId: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
}

export default function EditPartyPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const partyId = params.id;

  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/parties/${partyId}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setParty(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [partyId]);

  // Push party type to nav highlight context so sidebar can highlight Khách hàng / Nhà cung cấp
  useRegisterPartyDetailType(
    party?.type === "CUSTOMER" || party?.type === "SUPPLIER" ? party.type : null
  );

  async function handleSubmit(data: PartyFormData) {
    setSaveError(null);
    const res = await fetch(`/api/parties/${partyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) {
      setSaveError(json.message ?? "Lỗi cập nhật đối tác");
      throw new Error(json.message);
    }
    router.push(`/parties/${partyId}`);
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!party) {
    return <p className="text-sm text-slate-500">Không tìm thấy đối tác.</p>;
  }

  const initialData: Partial<PartyFormData> = {
    name: party.name,
    type: party.type,
    businessUnitId: party.businessUnitId,
    phone: party.phone ?? "",
    email: party.email ?? "",
    address: party.address ?? "",
    taxId: party.taxId ?? "",
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-xl font-bold text-slate-900">Sửa đối tác</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{party.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {saveError && <p className="mb-3 text-sm text-red-500">{saveError}</p>}
          <PartyForm mode="edit" initialData={initialData} onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}

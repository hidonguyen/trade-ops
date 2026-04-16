// Party detail — info card + deposit list
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, PencilIcon, Trash2Icon, ShoppingBagIcon } from "lucide-react";
import { useRegisterPartyDetailType } from "@/components/providers/nav-highlight-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { DepositList } from "@/components/deposit-list";

interface Party {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  businessUnit: { id: string; code: string; name: string };
}

const TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "Khách hàng",
  SUPPLIER: "Nhà cung cấp",
  BOTH: "KH & NCC",
};

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-slate-800">{value || "—"}</span>
    </div>
  );
}

export default function PartyDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const partyId = params.id;
  // Origin menu (CUSTOMER/SUPPLIER) passed by list page via ?from=... — used for back button
  // so BOTH parties (which appear in both menus) navigate back to the correct filtered list.
  const fromType = searchParams.get("from");

  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchParty = useCallback(async () => {
    try {
      const res = await fetch(`/api/parties/${partyId}`);
      const json = await res.json();
      if (json.success) setParty(json.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => { fetchParty(); }, [fetchParty]);

  // Push party type to nav highlight context so sidebar can highlight Khách hàng / Nhà cung cấp
  useRegisterPartyDetailType(
    party?.type === "CUSTOMER" || party?.type === "SUPPLIER" || party?.type === "BOTH"
      ? party.type
      : null
  );

  async function handleDelete() {
    await fetch(`/api/parties/${partyId}`, { method: "DELETE" });
    router.push("/parties");
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!party) {
    return <p className="text-sm text-slate-500">Không tìm thấy đối tác.</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              // Prefer origin menu from ?from=; else use party.type for CUSTOMER/SUPPLIER;
              // for BOTH without origin (direct URL), default to CUSTOMER so sidebar highlights something.
              const backType =
                fromType === "CUSTOMER" || fromType === "SUPPLIER"
                  ? fromType
                  : party.type === "CUSTOMER" || party.type === "SUPPLIER"
                  ? party.type
                  : "CUSTOMER";
              router.push(`/parties?type=${backType}`);
            }}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{party.name}</h1>
            <p className="text-sm text-slate-500">{TYPE_LABELS[party.type] ?? party.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(party.type === "CUSTOMER" || party.type === "BOTH") && (
            <Button variant="outline" size="sm"
              onClick={() => router.push(`/orders?type=SALE&partyId=${partyId}`)}>
              <ShoppingBagIcon className="size-4 mr-1" />Xem đơn bán
            </Button>
          )}
          {(party.type === "SUPPLIER" || party.type === "BOTH") && (
            <Button variant="outline" size="sm"
              onClick={() => router.push(`/orders?type=PURCHASE&partyId=${partyId}`)}>
              <ShoppingBagIcon className="size-4 mr-1" />Xem đơn mua
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => router.push(`/parties/${partyId}/edit`)}>
            <PencilIcon className="size-4 mr-1" />Sửa
          </Button>
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setDeleteOpen(true)}>
            <Trash2Icon className="size-4 mr-1" />Xóa
          </Button>
        </div>
      </div>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin liên hệ</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0 px-6 pb-4">
          <InfoRow label="Đơn vị kinh doanh" value={`${party.businessUnit.code} — ${party.businessUnit.name}`} />
          <InfoRow label="Loại đối tác" value={TYPE_LABELS[party.type] ?? party.type} />
          <InfoRow label="Số điện thoại" value={party.phone} />
          <InfoRow label="Email" value={party.email} />
          <InfoRow label="Mã số thuế" value={party.taxId} />
          <InfoRow label="Địa chỉ" value={party.address} />
        </CardContent>
      </Card>

      {/* Deposits */}
      <Card>
        <CardContent className="pt-5">
          <DepositList partyId={partyId} />
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={deleteOpen}
        title="Xóa đối tác"
        description={`Bạn có chắc muốn xóa "${party.name}"? Hành động này không thể hoàn tác.`}
        variant="danger"
        confirmLabel="Xóa"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}

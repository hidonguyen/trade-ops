// Deposit list with remaining balances — fetches /api/parties/[id]/deposits
"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/data-table";
import { CurrencyAmount } from "@/components/shared/currency-amount";
import { DepositForm } from "@/components/deposit-form";

interface Deposit {
  id: string;
  amountOriginal: string;
  remainingOriginal: string;
  createdAt: string;
  currency: { id: string; code: string; symbol: string };
  businessUnit: { id: string; code: string; name: string };
}

interface DepositListProps {
  partyId: string;
}

export function DepositList({ partyId }: DepositListProps) {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/parties/${partyId}/deposits`);
      const json = await res.json();
      if (json.success) setDeposits(json.data);
    } catch {
      // silently fail — table shows empty state
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "createdAt", label: "Ngày", sortable: true,
      render: (v) => new Date(String(v)).toLocaleDateString("vi-VN"),
    },
    {
      key: "businessUnit", label: "Đơn vị",
      render: (v) => {
        const bu = v as Deposit["businessUnit"];
        return <span className="text-sm">{bu?.code}</span>;
      },
    },
    {
      key: "amountOriginal", label: "Số tiền gốc", align: "right",
      render: (v, row) => {
        const dep = row as unknown as Deposit;
        return <CurrencyAmount amount={String(v)} currencySymbol={dep.currency.symbol} currencyCode={dep.currency.code} />;
      },
    },
    {
      key: "remainingOriginal", label: "Còn lại", align: "right",
      render: (v, row) => {
        const dep = row as unknown as Deposit;
        const remaining = parseFloat(String(v));
        return (
          <CurrencyAmount
            amount={String(v)}
            currencySymbol={dep.currency.symbol}
            currencyCode={dep.currency.code}
            className={remaining <= 0 ? "text-slate-400 line-through" : "text-green-700"}
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Tiền đặt cọc</h3>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <PlusIcon className="size-4 mr-1" />Thêm cọc
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={deposits as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Chưa có tiền đặt cọc"
      />

      <DepositForm
        partyId={partyId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => { setDialogOpen(false); fetchDeposits(); }}
      />
    </div>
  );
}

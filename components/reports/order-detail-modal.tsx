"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderInfoCard } from "@/app/(dashboard)/orders/[id]/order-info-card";
import { FinancialSummaryCard } from "@/app/(dashboard)/orders/[id]/financial-summary-card";
import { OrderTransactionsTable } from "@/app/(dashboard)/orders/[id]/order-transactions-table";

interface ReportData {
  order: {
    id: string;
    type: string;
    status: string;
    orderNumber: string;
    orderDate: string;
    amountOriginal: string;
    exchangeRate?: string | null;
    paymentDueDate?: string | null;
    notes: string | null;
    party: { id: string; name: string; type: string };
    currency: { id: string; code: string; symbol: string };
    businessUnit: { id: string; code: string; name: string };
    expenseType?: { id: string; name: string; isActive: boolean } | null;
  };
  summary: {
    orderAmountOriginal: string;
    adjustmentTotalOriginal?: string;
    effectiveValueOriginal?: string;
    totalPaidOriginal: string;
    totalRefundedOriginal: string;
    netPaidOriginal: string;
    balanceOriginal: string;
    bankPaymentsOriginal: string;
    depositPaymentsOriginal: string;
    bankRefundsOriginal?: string;
    depositRefundsOriginal?: string;
    transactionCount: number;
  };
  transactions: Array<{
    id: string;
    paymentType: string;
    paymentMethod: string;
    amountOriginal: string;
    amountVnd: string;
    exchangeRate: string;
    bankReference: string | null;
    transactionDate: string;
    notes: string | null;
    bankFeeOriginal: string | null;
    bankFeeVnd: string | null;
    currency: { id: string; code: string; symbol: string };
  }>;
}

interface Props {
  orderId: string | null;
  onClose: () => void;
}

export function OrderDetailModal({ orderId, onClose }: Props) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/orders/${orderId}/report`)
      .then((r) => r.json())
      .then((res) => setData(res?.success ? (res.data as ReportData) : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <Dialog open={!!orderId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogTitle>Chi tiết đơn hàng</DialogTitle>
        {loading || !data ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <OrderInfoCard order={data.order} adjustmentTotal={data.summary.adjustmentTotalOriginal} />
              <FinancialSummaryCard
                summary={data.summary}
                currencyCode={data.order.currency.code}
                currencySymbol={data.order.currency.symbol}
              />
            </div>
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-slate-800">Giao dịch thanh toán</h2>
              <OrderTransactionsTable
                orderId={data.order.id}
                transactions={data.transactions}
                onDeleted={() => {}}
                canDelete={false}
                canEdit={false}
              />
            </div>
            <div className="flex justify-end pt-2">
              <a href={`/orders/${data.order.id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">Mở trang đầy đủ ↗</Button>
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

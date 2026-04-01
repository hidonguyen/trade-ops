// Order detail page — info card + financial summary + transaction list + payment dialog
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PaymentForm } from "@/components/payment-form";
import { OrderInfoCard } from "./order-info-card";
import { FinancialSummaryCard } from "./financial-summary-card";
import { OrderTransactionsTable } from "./order-transactions-table";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusIcon, PencilIcon } from "lucide-react";

interface OrderReport {
  order: {
    id: string;
    type: string;
    status: string;
    orderDate: string;
    amountOriginal: string;
    notes: string | null;
    party: { id: string; name: string; type: string };
    currency: { id: string; code: string; symbol: string };
    businessUnit: { id: string; code: string; name: string };
  };
  summary: {
    orderAmountOriginal: string;
    totalPaidOriginal: string;
    totalRefundedOriginal: string;
    netPaidOriginal: string;
    balanceOriginal: string;
    bankPaymentsOriginal: string;
    depositPaymentsOriginal: string;
    transactionCount: number;
  };
  transactions: {
    id: string;
    paymentType: string;
    paymentMethod: string;
    amountOriginal: string;
    amountVnd: string;
    exchangeRate: string;
    bankReference: string | null;
    transactionDate: string;
    notes: string | null;
    currency: { id: string; code: string; symbol: string };
  }[];
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<OrderReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}/report`);
      const json = await res.json();
      if (json.success) setReport(json.data);
      else router.push("/orders");
    } catch (err) {
      console.error("Failed to fetch order report:", err);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!report) return null;

  const { order, summary, transactions } = report;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push("/orders")}
            className="text-sm text-slate-500 hover:text-slate-700 mb-1"
          >
            ← Đơn hàng
          </button>
          <h1 className="text-xl font-semibold text-slate-900">
            Chi tiết đơn — {order.party?.name}
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/orders/${id}/edit`)}
        >
          <PencilIcon className="size-4 mr-1.5" />
          Chỉnh sửa
        </Button>
      </div>

      {/* Info + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OrderInfoCard order={order} />
        <FinancialSummaryCard
          summary={summary}
          currencyCode={order.currency?.code}
          currencySymbol={order.currency?.symbol}
        />
      </div>

      {/* Transaction list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Giao dịch thanh toán</h2>
          <Button size="sm" onClick={() => setPaymentOpen(true)}>
            <PlusIcon className="size-4 mr-1.5" />
            Thêm thanh toán
          </Button>
        </div>
        <OrderTransactionsTable
          orderId={id}
          transactions={transactions}
          onDeleted={fetchReport}
        />
      </div>

      {/* Payment dialog */}
      <PaymentForm
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={fetchReport}
        orderId={id}
        orderType={order.type}
        partyId={order.party?.id}
        currency={order.currency}
      />
    </div>
  );
}

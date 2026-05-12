// Order detail page — info card + financial summary + transaction list + payment dialog
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useRegisterOrderDetailType } from "@/components/providers/nav-highlight-provider";
import { Button } from "@/components/ui/button";
import { PaymentForm, EditingTransaction } from "@/components/payment-form";
import { OrderAdjustmentForm, EditingAdjustment } from "@/components/order-adjustment-form";
import { OrderInfoCard } from "./order-info-card";
import { FinancialSummaryCard } from "./financial-summary-card";
import { OrderTransactionsTable } from "./order-transactions-table";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusIcon, PencilIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import Decimal from "decimal.js";
import { useCan, useRoles } from "@/components/providers/roles-provider";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";

interface OrderReport {
  order: {
    id: string;
    type: string;
    status: string;
    orderNumber: string;
    orderDate: string;
    amountOriginal: string;
    exchangeRate?: string;
    paymentDueDate?: string | null;
    notes: string | null;
    party: { id: string; name: string; type: string };
    currency: { id: string; code: string; symbol: string };
    businessUnit: { id: string; code: string; name: string };
    expenseType?: { id: string; name: string; isActive: boolean } | null;
  };
  summary: {
    orderAmountOriginal: string;
    adjustmentTotalOriginal: string;
    effectiveValueOriginal: string;
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
    bankFeeOriginal: string | null;
    bankFeeVnd: string | null;
    currency: { id: string; code: string; symbol: string };
  }[];
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<OrderReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<EditingTransaction | null>(null);
  const [editingAdj, setEditingAdj] = useState<EditingAdjustment | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const roles = useRoles();
  const isAdmin = roles.includes("ADMIN");

  // RBAC capabilities — order-linked tx writes are gated by parent order module
  // (SALE/PURCHASE), matching the API. RECEIPT/PAYMENT module gates only the
  // standalone /transactions screen.
  const canEditSale = useCan("UPDATE", "SALE");
  const canEditPurchase = useCan("UPDATE", "PURCHASE");
  const canCreateSale = useCan("CREATE", "SALE");
  const canCreatePurchase = useCan("CREATE", "PURCHASE");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}/report`);
      const json = await res.json();
      if (json.success) setReport(json.data);
      else router.push("/orders");
    } catch (err) {
      console.error("Lỗi tải báo cáo đơn hàng:", err);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  useRegisterOrderDetailType(
    report?.order?.type === "SALE" || report?.order?.type === "PURCHASE"
      ? report.order.type
      : null
  );

  // Compute max payment amount for overpayment hint
  const maxPaymentAmount = useMemo(() => {
    if (!report) return undefined;
    try {
      // Use effectiveValueOriginal so balance accounts for adjustments
      const effective = new Decimal(report.summary.effectiveValueOriginal ?? report.summary.orderAmountOriginal);
      const paid = new Decimal(report.summary.totalPaidOriginal ?? "0");
      const refunded = new Decimal(report.summary.totalRefundedOriginal ?? "0");
      let max = Decimal.max(effective.minus(paid).plus(refunded), new Decimal(0));
      if (editingTx && editingTx.paymentType === "PAYMENT") {
        max = max.plus(new Decimal(editingTx.amountOriginal));
      }
      return max.toDecimalPlaces(4).toString();
    } catch {
      return undefined;
    }
  }, [report, editingTx]);

  function handleOpenCreate() { setEditingTx(null); setPaymentOpen(true); }
  function handleOpenAdjustment() { setEditingAdj(null); setAdjustmentOpen(true); }
  function handleEdit(tx: EditingTransaction) {
    // Route ADJUSTMENT edits to the dedicated adjustment form; regular payments to PaymentForm
    if (tx.paymentType === "ADJUSTMENT") {
      setEditingAdj({
        id: tx.id,
        amountOriginal: tx.amountOriginal,
        exchangeRate: tx.exchangeRate,
        amountVnd: tx.amountVnd,
        transactionDate: tx.transactionDate,
        notes: tx.notes,
      });
      setAdjustmentOpen(true);
    } else {
      setEditingTx(tx);
      setPaymentOpen(true);
    }
  }
  function handleClosePayment() { setPaymentOpen(false); setEditingTx(null); }
  function handleCloseAdjustment() { setAdjustmentOpen(false); setEditingAdj(null); }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (res.status === 204) {
        setDeleteOpen(false);
        router.push(`/orders?type=${report?.order.type ?? ""}`);
        return;
      }
      const json = await res.json().catch(() => ({}));
      alert(json.message ?? "Không thể xóa đơn hàng");
    } catch (err) {
      console.error("DELETE order error:", err);
      alert("Lỗi kết nối");
    } finally {
      setDeleting(false);
    }
  }

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

  // Resolve role caps based on order type. SALE: payment in = RECEIPT, refund = PAYMENT.
  // PURCHASE: payment out = PAYMENT, refund = RECEIPT.
  const canEditOrder = order.type === "SALE" ? canEditSale : canEditPurchase;
  const canCreatePaymentTx = order.type === "SALE" ? canCreateSale : canCreatePurchase;
  // Refund creates the opposite cash direction, so map via the matrix accordingly.
  // (UI only exposes "Thêm thanh toán" — refund is created via a different flow if any.)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push(`/orders?type=${order.type}`)}
            className="text-sm text-slate-500 hover:text-slate-700 mb-1"
          >
            ← {order.type === "SALE" ? "Đơn bán" : "Đơn mua"}
          </button>
          <h1 className="text-xl font-semibold text-slate-900">
            Chi tiết đơn — {order.party?.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {canEditOrder && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/orders/${id}/edit`)}
            >
              <PencilIcon className="size-4 mr-1.5" />
              Chỉnh sửa
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => setDeleteOpen(true)}
              disabled={summary.transactionCount > 0}
              title={summary.transactionCount > 0 ? "Đã có giao dịch — không thể xóa" : undefined}
            >
              <Trash2Icon className="size-4 mr-1.5" />
              Xóa đơn
            </Button>
          )}
        </div>
      </div>

      {/* Info + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OrderInfoCard order={order} adjustmentTotal={report.summary.adjustmentTotalOriginal} />
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
          <div className="flex gap-2">
            {canEditOrder && (
              <Button size="sm" variant="outline" onClick={handleOpenAdjustment}>
                <SlidersHorizontalIcon className="size-4 mr-1.5" />
                Thêm điều chỉnh
              </Button>
            )}
            {canCreatePaymentTx && (
              <Button size="sm" onClick={handleOpenCreate}>
                <PlusIcon className="size-4 mr-1.5" />
                Thêm thanh toán
              </Button>
            )}
          </div>
        </div>
        <OrderTransactionsTable
          orderId={id}
          orderType={order.type}
          transactions={transactions}
          onDeleted={fetchReport}
          onEdit={handleEdit}
        />
      </div>

      {/* Payment dialog (create + edit) */}
      <PaymentForm
        open={paymentOpen}
        onClose={handleClosePayment}
        onSuccess={fetchReport}
        orderId={id}
        orderType={order.type}
        partyId={order.party?.id}
        currency={order.currency}
        editingTransaction={editingTx}
        maxPaymentAmount={maxPaymentAmount}
      />

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={deleteOpen}
        title={`Xóa đơn #${order.orderNumber}?`}
        description="Hành động này không thể khôi phục. Đơn sẽ bị xóa vĩnh viễn khỏi hệ thống."
        variant="danger"
        confirmLabel={deleting ? "Đang xóa..." : "Xóa vĩnh viễn"}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      {/* Adjustment dialog (create + edit) */}
      <OrderAdjustmentForm
        open={adjustmentOpen}
        onClose={handleCloseAdjustment}
        onSuccess={fetchReport}
        orderId={id}
        orderType={order.type}
        currency={order.currency}
        editingTransaction={editingAdj}
      />
    </div>
  );
}

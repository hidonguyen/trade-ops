// Edit order page — fetches existing order, renders OrderForm in edit mode
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useRegisterOrderDetailType } from "@/components/providers/nav-highlight-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderForm, OrderFormData } from "@/components/order-form";
import { Skeleton } from "@/components/ui/skeleton";

interface OrderData {
  id: string;
  type: string;
  status: string;
  orderDate: string;
  amountOriginal: string;
  exchangeRate: string | null;
  paymentDueDate: string | null;
  notes: string | null;
  partyId: string;
  currencyId: string;
  businessUnitId: string;
  orderNumber: string;
  expenseTypeId: string | null;
  transactions?: { id: string; paymentMethod: string }[];
}

export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setOrder(json.data);
        else setError(json.message ?? "Không tìm thấy đơn hàng");
      })
      .catch(() => setError("Lỗi tải đơn hàng"))
      .finally(() => setLoading(false));
  }, [id]);

  // Push order type to nav highlight context so sidebar can highlight Đơn bán / Đơn mua
  useRegisterOrderDetailType(
    order?.type === "SALE" || order?.type === "PURCHASE" ? order.type : null
  );

  async function handleSubmit(data: OrderFormData) {
    const txList = order?.transactions ?? [];
    const hasTx = txList.length > 0;
    const hasDepositTx = txList.some((t) => t.paymentMethod === "DEPOSIT");

    const body: Record<string, unknown> = {
      notes: data.notes,
      orderDate: new Date(data.orderDate).toISOString(),
      orderNumber: data.orderNumber,
      expenseTypeId: data.type === "PURCHASE" ? data.expenseTypeId || null : null,
      exchangeRate: data.exchangeRate || "1",
      paymentDueDate: data.paymentDueDate ? new Date(data.paymentDueDate).toISOString() : null,
    };
    // Only send locked fields when not locked, so server's lock guards don't 409
    // on otherwise valid edits to free fields.
    if (!hasTx) {
      body.amountOriginal = data.amountOriginal;
      body.currencyId = data.currencyId;
    }
    if (!hasDepositTx) {
      body.partyId = data.partyId;
    }

    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message ?? "Lỗi cập nhật đơn hàng");
    router.push(`/orders/${id}`);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? "Không tìm thấy đơn hàng"}
        </div>
      </div>
    );
  }

  const initialData: Partial<OrderFormData> = {
    type: order.type,
    partyId: order.partyId,
    businessUnitId: order.businessUnitId,
    orderNumber: order.orderNumber,
    amountOriginal: String(order.amountOriginal),
    currencyId: order.currencyId,
    orderDate: order.orderDate.split("T")[0],
    notes: order.notes ?? "",
    expenseTypeId: order.expenseTypeId ?? "",
    exchangeRate: order.exchangeRate ? String(order.exchangeRate) : "1",
    paymentDueDate: order.paymentDueDate ? order.paymentDueDate.split("T")[0] : "",
  };

  const txList = order.transactions ?? [];
  const lockAmountCurrency = txList.length > 0;
  const lockParty = txList.some((t) => t.paymentMethod === "DEPOSIT");

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <button
          onClick={() => router.push(`/orders/${id}`)}
          className="text-sm text-slate-500 hover:text-slate-700 mb-1"
        >
          ← Chi tiết đơn hàng
        </button>
        <h1 className="text-xl font-semibold text-slate-900">Chỉnh sửa đơn hàng</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin đơn hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderForm
            mode="edit"
            initialData={initialData}
            onSubmit={handleSubmit}
            lockAmountCurrency={lockAmountCurrency}
            lockParty={lockParty}
          />
        </CardContent>
      </Card>
    </div>
  );
}

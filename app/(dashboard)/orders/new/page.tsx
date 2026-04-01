// Create order page — wraps OrderForm in create mode, redirects to detail on success
"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderForm, OrderFormData } from "@/components/order-form";

export default function NewOrderPage() {
  const router = useRouter();

  async function handleSubmit(data: OrderFormData) {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        orderDate: new Date(data.orderDate).toISOString(),
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message ?? "Lỗi tạo đơn hàng");
    router.push(`/orders/${json.data.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Tạo đơn hàng mới</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin đơn hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderForm mode="create" onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}

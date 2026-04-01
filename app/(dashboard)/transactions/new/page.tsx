// Create standalone transaction page — wraps TransactionForm
"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionForm } from "@/components/transaction-form";

export default function NewTransactionPage() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <button
          onClick={() => router.push("/transactions")}
          className="text-sm text-slate-500 hover:text-slate-700 mb-1"
        >
          ← Giao dịch
        </button>
        <h1 className="text-xl font-semibold text-slate-900">Thêm giao dịch mới</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin giao dịch</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm onSuccess={() => router.push("/transactions")} />
        </CardContent>
      </Card>
    </div>
  );
}

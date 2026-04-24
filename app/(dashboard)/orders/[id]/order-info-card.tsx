// Order info card sub-component — displays party, type, date, currency, status
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyAmount } from "@/components/shared/currency-amount";

interface Order {
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
}

interface OrderInfoCardProps {
  order: Order;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function OrderInfoCard({ order }: OrderInfoCardProps) {
  const rate = parseFloat(order.exchangeRate ?? "1");
  const isNonVnd = order.currency?.code !== "VND";
  // Derived VND equivalent — only shown when currency is non-VND and rate meaningful
  const vndEquivalent =
    isNonVnd && rate > 0
      ? (parseFloat(order.amountOriginal ?? "0") * rate)
          .toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " ₫"
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Thông tin đơn hàng</CardTitle>
          <StatusBadge status={order.status} />
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Số đơn hàng</dt>
            <dd className="font-medium mt-0.5">{order.orderNumber}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Đối tác</dt>
            <dd className="font-medium mt-0.5">{order.party?.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Loại đơn</dt>
            <dd className="mt-0.5">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                order.type === "SALE"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-purple-100 text-purple-700"
              }`}>
                {order.type === "SALE" ? "Bán hàng" : "Mua hàng"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Ngày đặt</dt>
            <dd className="font-medium mt-0.5">{formatDate(order.orderDate)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Hạn thanh toán</dt>
            <dd className="font-medium mt-0.5">{formatDate(order.paymentDueDate)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Đơn vị</dt>
            <dd className="font-medium mt-0.5">{order.businessUnit?.code}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Số tiền</dt>
            <dd className="font-medium mt-0.5">
              <CurrencyAmount
                amount={order.amountOriginal}
                currencyCode={order.currency?.code}
                currencySymbol={order.currency?.symbol}
              />
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Tiền tệ</dt>
            <dd className="font-medium mt-0.5">
              {order.currency?.symbol} {order.currency?.code}
            </dd>
          </div>
          {isNonVnd && (
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wide">Tỷ giá</dt>
              <dd className="font-medium mt-0.5 font-mono">
                {rate.toLocaleString("vi-VN", { maximumFractionDigits: 8 })}
              </dd>
            </div>
          )}
          {vndEquivalent && (
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wide">Tương đương VND</dt>
              <dd className="font-medium mt-0.5 font-mono text-slate-700">{vndEquivalent}</dd>
            </div>
          )}
          {order.type === "PURCHASE" && order.expenseType && (
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wide">Loại chi phí</dt>
              <dd className="font-medium mt-0.5">
                {order.expenseType.name}
                {!order.expenseType.isActive && (
                  <span className="ml-1 text-xs text-slate-400">(ngừng)</span>
                )}
              </dd>
            </div>
          )}
          {order.notes && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-slate-500 text-xs uppercase tracking-wide">Diễn giải</dt>
              <dd className="mt-0.5 text-slate-700">{order.notes}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

// Compact icon button: opens /orders/[id] in a new tab. Renders dash when no orderId.
import { ExternalLinkIcon } from "lucide-react";

export function OrderLinkCell({ orderId }: { orderId: string | null | undefined }) {
  if (!orderId) return <span className="text-gray-300">—</span>;
  return (
    <a
      href={`/orders/${orderId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center text-blue-600 hover:text-blue-800"
      onClick={(e) => e.stopPropagation()}
      title="Mở đơn hàng (tab mới)"
    >
      <ExternalLinkIcon className="w-4 h-4" />
    </a>
  );
}
